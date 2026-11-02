"""The admin API: logging in and out, and the guard every admin route goes through.

The browser keeps the session token in a cookie it can't read from JavaScript (HttpOnly)
and only sends to these routes, from this site (Path, SameSite=Strict). The database keeps
the token's hash, so logging out, or deleting the row, ends the session on the spot.
"""

from typing import Annotated

from fastapi import APIRouter, Body, Cookie, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from ragnavigator.assistant import live_index
from ragnavigator.auth import (
    DUMMY_PASSWORD_HASH,
    SESSION_LIFETIME,
    hash_token,
    new_session_token,
    utcnow,
    verify_password,
)
from ragnavigator.db import SessionDep
from ragnavigator.indexing import reindex_entry, reindex_location, remove_entry, remove_location
from ragnavigator.models import (
    AdminSession,
    AdminUser,
    Category,
    Entry,
    EntryLocation,
    Location,
    Organization,
    Requirement,
)
from ragnavigator.schemas import (
    AdminOut,
    CategoryIn,
    CategoryOut,
    EntryIn,
    EntryLocationIn,
    LocationIn,
    LocationOut,
    EntrySummaryOut,
    LoginIn,
    OrganizationIn,
    RequirementIn,
)
from ragnavigator.slugs import slugify

COOKIE_NAME = "ragnavigator_session"
COOKIE_PATH = "/api/admin"

router = APIRouter(prefix="/api/admin")

SessionToken = Annotated[str | None, Cookie(alias=COOKIE_NAME)]


def current_admin(session: SessionDep, token: SessionToken = None) -> AdminUser:
    """The logged-in admin, or a 401. Admin routes declare `admin: CurrentAdmin`."""
    if token is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    admin_session = session.scalar(
        select(AdminSession)
        .where(AdminSession.token_hash == hash_token(token), AdminSession.expires_at > utcnow())
        .options(joinedload(AdminSession.admin))
    )
    if admin_session is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    return admin_session.admin


CurrentAdmin = Annotated[AdminUser, Depends(current_admin)]


@router.post("/login")
def login(body: LoginIn, session: SessionDep, response: Response) -> AdminOut:
    admin = session.scalar(select(AdminUser).where(AdminUser.username == body.username))
    password_hash = admin.password_hash if admin else DUMMY_PASSWORD_HASH
    # One message for both cases: which one failed would tell a stranger a username exists.
    if not verify_password(body.password, password_hash) or admin is None:
        raise HTTPException(status_code=401, detail="Wrong username or password")

    now = utcnow()
    # Expired sessions are cleared here, so the table never needs a cleanup job.
    session.execute(delete(AdminSession).where(AdminSession.expires_at <= now))
    token = new_session_token()
    session.add(
        AdminSession(
            admin=admin,
            token_hash=hash_token(token),
            created_at=now,
            expires_at=now + SESSION_LIFETIME,
        )
    )
    session.commit()

    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        path=COOKIE_PATH,
        # Browsers treat http://localhost as secure, so this works in development too.
        secure=True,
        httponly=True,
        # Never sent with a request started by another site: that's the CSRF protection.
        samesite="strict",
    )
    return AdminOut.model_validate(admin)


@router.post("/logout", status_code=204)
def logout(session: SessionDep, response: Response, token: SessionToken = None) -> None:
    # Works without a valid session too: logging out should never fail.
    if token is not None:
        session.execute(delete(AdminSession).where(AdminSession.token_hash == hash_token(token)))
        session.commit()
    response.delete_cookie(
        COOKIE_NAME, path=COOKIE_PATH, secure=True, httponly=True, samesite="strict"
    )


@router.get("/me")
def me(admin: CurrentAdmin) -> AdminOut:
    """Who's logged in. The frontend asks this to decide between the editor and the login."""
    return AdminOut.model_validate(admin)


@router.post("/entries", status_code=201)
def create_entry(body: EntryIn, session: SessionDep, admin: CurrentAdmin) -> EntrySummaryOut:
    """A new entry with its text only: requirements and places are added once it exists."""
    # Like a category's, the slug comes from the title once and stays: it's the page's URL.
    slug = slugify(body.title)
    if not slug:
        raise HTTPException(status_code=422, detail="The title needs a letter or a number")
    if session.scalar(select(Entry.id).where(Entry.slug == slug)) is not None:
        raise HTTPException(status_code=409, detail="There's already an entry with that title")
    entry = Entry(slug=slug)
    _set_entry_fields(session, entry, body)
    session.add(entry)
    session.commit()
    reindex_entry(live_index(), entry)
    return EntrySummaryOut.model_validate(entry)


@router.put("/entries/{slug}", status_code=204)
def update_entry(slug: str, body: EntryIn, session: SessionDep, admin: CurrentAdmin) -> None:
    entry = _get_entry(session, slug)
    _set_entry_fields(session, entry, body)
    session.commit()
    # Before responding, so "saved" in the admin also means the assistant answers with the
    # new text. If the server hasn't loaded the index yet, this first save loads it (the
    # embedding model takes ~20 s); after that it's about a second.
    reindex_entry(live_index(), entry)


@router.delete("/entries/{slug}", status_code=204)
def delete_entry(slug: str, session: SessionDep, admin: CurrentAdmin) -> None:
    entry = _get_entry(session, slug)
    # Read before deleting: afterwards the links to them are gone too.
    places = list({link.location.slug: link.location for link in entry.locations}.values())
    # Its requirements and place links go with it (cascades on both).
    session.delete(entry)
    session.commit()
    remove_entry(live_index(), slug, places)


@router.put("/entries/{slug}/requirements", status_code=204)
def replace_requirements(
    slug: str,
    body: Annotated[list[RequirementIn], Body(max_length=50)],
    session: SessionDep,
    admin: CurrentAdmin,
) -> None:
    """The whole list, as it should be now: adding, editing, removing and reordering are all
    one save. Requirements have no identity of their own (nothing links to one), so the old
    rows are simply replaced."""
    entry = _get_entry(session, slug)
    # The old rows are deleted on commit (delete-orphan); the list order becomes `position`.
    entry.requirements = [
        Requirement(name=item.name, description=item.description or None, position=position)
        for position, item in enumerate(body)
    ]
    session.commit()
    # An entry without requirements loses its requirements document too.
    reindex_entry(live_index(), entry)


@router.put("/entries/{slug}/locations", status_code=204)
def replace_locations(
    slug: str,
    body: Annotated[list[EntryLocationIn], Body(max_length=20)],
    session: SessionDep,
    admin: CurrentAdmin,
) -> None:
    """The entry's places, as the whole list in step order, like its requirements. Places
    themselves are only picked here, by slug: they're shared with other entries."""
    entry = _get_entry(session, slug)
    pairs = [(item.location, item.role) for item in body]
    # The pair is the link's key: the same place twice is fine, with the same role it isn't.
    if len(set(pairs)) != len(pairs):
        raise HTTPException(status_code=422, detail="The same place and role appear twice")
    slugs = {location for location, _ in pairs}
    locations = {
        location.slug: location
        for location in session.scalars(select(Location).where(Location.slug.in_(slugs)))
    }
    if len(locations) != len(slugs):
        raise HTTPException(status_code=422, detail="Unknown place")

    # Read before replacing: a place taken off the entry still names it in the index.
    former_places = [link.location for link in entry.locations]
    # A link kept as it was has the same key as the old row: SQLAlchemy turns that delete
    # plus insert into an update ("row switch"), so replacing the whole list is safe.
    entry.locations = [
        EntryLocation(location=locations[location], role=role, position=position)
        for position, (location, role) in enumerate(pairs)
    ]
    session.commit()
    reindex_entry(live_index(), entry, former_places)


def _get_entry(session: Session, slug: str) -> Entry:
    entry = session.scalar(select(Entry).where(Entry.slug == slug))
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


def _set_entry_fields(session: Session, entry: Entry, body: EntryIn) -> None:
    category = session.scalar(select(Category).where(Category.slug == body.category))
    if category is None:
        raise HTTPException(status_code=422, detail="Unknown category")
    entry.category = category
    for field, value in body.model_dump(exclude={"category"}).items():
        # A blank optional field means "not set", the same as leaving it out of the catalog.
        setattr(entry, field, value or None)


@router.post("/locations", status_code=201)
def create_location(body: LocationIn, session: SessionDep, admin: CurrentAdmin) -> LocationOut:
    # Like an entry's, the slug comes from the name once and stays.
    slug = slugify(body.name)
    if not slug:
        raise HTTPException(status_code=422, detail="The name needs a letter or a number")
    if session.scalar(select(Location.id).where(Location.slug == slug)) is not None:
        raise HTTPException(status_code=409, detail="There's already a place with that name")
    location = Location(slug=slug)
    _set_location_fields(location, body)
    session.add(location)
    session.commit()
    # Indexed right away: the assistant can answer where a place is before any entry uses it.
    reindex_location(live_index(), location)
    return LocationOut.model_validate(location)


@router.put("/locations/{slug}", status_code=204)
def update_location(
    slug: str, body: LocationIn, session: SessionDep, admin: CurrentAdmin
) -> None:
    location = _get_location(session, slug)
    _set_location_fields(location, body)
    session.commit()
    # Its document, and the "where and when" of every entry that sends people there.
    reindex_location(live_index(), location)


@router.delete("/locations/{slug}", status_code=204)
def delete_location(slug: str, session: SessionDep, admin: CurrentAdmin) -> None:
    location = _get_location(session, slug)
    # Only when unused, like a category: entries would otherwise lose a step silently.
    if location.entries:
        raise HTTPException(status_code=409, detail="Some entries still use this place")
    session.delete(location)
    session.commit()
    remove_location(live_index(), slug)


def _get_location(session: Session, slug: str) -> Location:
    location = session.scalar(select(Location).where(Location.slug == slug))
    if location is None:
        raise HTTPException(status_code=404, detail="Place not found")
    return location


def _set_location_fields(location: Location, body: LocationIn) -> None:
    for field, value in body.model_dump().items():
        # Blank optional fields mean "not set", as for entries.
        setattr(location, field, value or None)


@router.put("/organization", status_code=204)
def update_organization(body: OrganizationIn, session: SessionDep, admin: CurrentAdmin) -> None:
    """Name and color. Nothing to re-index: neither is in the index; the site reads them on
    its next load."""
    # The same single row GET /api/organization reads.
    organization = session.scalar(select(Organization).order_by(Organization.id).limit(1))
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not configured")
    organization.name = body.name
    organization.primary_color = body.primary_color
    session.commit()


@router.post("/categories", status_code=201)
def create_category(body: CategoryIn, session: SessionDep, admin: CurrentAdmin) -> CategoryOut:
    # The slug comes from the name once and stays: it's in the home page's #anchors.
    slug = slugify(body.name)
    if not slug:
        raise HTTPException(status_code=422, detail="The name needs a letter or a number")
    if session.scalar(select(Category.id).where(Category.slug == slug)) is not None:
        raise HTTPException(status_code=409, detail="There's already a category with that name")
    category = Category(name=body.name, slug=slug)
    session.add(category)
    session.commit()
    return CategoryOut.model_validate(category)


@router.put("/categories/{slug}", status_code=204)
def rename_category(
    slug: str, body: CategoryIn, session: SessionDep, admin: CurrentAdmin
) -> None:
    """Change the name; the slug stays, so links to the category keep working."""
    category = _get_category(session, slug)
    category.name = body.name
    session.commit()
    # Each entry's summary document says which category it's in.
    if category.entries:
        index = live_index()
        for entry in category.entries:
            reindex_entry(index, entry)


@router.delete("/categories/{slug}", status_code=204)
def delete_category(slug: str, session: SessionDep, admin: CurrentAdmin) -> None:
    category = _get_category(session, slug)
    # Only when empty: deleting its entries along with it would be too easy by mistake.
    if category.entries:
        raise HTTPException(status_code=409, detail="The category still has entries")
    session.delete(category)
    session.commit()


def _get_category(session: Session, slug: str) -> Category:
    category = session.scalar(select(Category).where(Category.slug == slug))
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found")
    return category
