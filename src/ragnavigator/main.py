from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ragnavigator.db import get_session
from ragnavigator.models import Category, Entry, EntryLocation, Location, Organization
from ragnavigator.pdf import requirements_pdf
from ragnavigator.schemas import (
    CategoryWithEntriesOut,
    EntryOut,
    LocationWithEntriesOut,
    OrganizationOut,
)

app = FastAPI(title="ragnavigator")

SessionDep = Annotated[Session, Depends(get_session)]


@app.get("/api/organization")
def get_organization(session: SessionDep) -> OrganizationOut:
    # A single row; the first one wins if there were ever more.
    organization = session.scalar(select(Organization).order_by(Organization.id).limit(1))
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not configured")
    return OrganizationOut.model_validate(organization)


@app.get("/api/categories")
def list_categories(session: SessionDep) -> list[CategoryWithEntriesOut]:
    # The whole catalog in one response: it's a few dozen entries, and both the home page
    # and a category page need it. Split per category if a catalog ever gets large.
    categories = session.scalars(
        select(Category).order_by(Category.id).options(selectinload(Category.entries))
    )
    return [CategoryWithEntriesOut.model_validate(c) for c in categories]


@app.get("/api/entries/{slug}")
def get_entry(slug: str, session: SessionDep) -> EntryOut:
    return EntryOut.model_validate(_load_entry(session, slug))


@app.get("/api/entries/{slug}/requirements.pdf")
def get_entry_pdf(slug: str, session: SessionDep) -> Response:
    entry = _load_entry(session, slug)
    return Response(
        requirements_pdf(entry),
        media_type="application/pdf",
        # "attachment" makes the browser download it, under a name that says what it is.
        headers={"Content-Disposition": f'attachment; filename="requisitos-{slug}.pdf"'},
    )


def _load_entry(session: Session, slug: str) -> Entry:
    # Everything the page and the PDF show, in one go (a few queries, not one per
    # requirement or location), while the session is still open.
    entry = session.scalar(
        select(Entry)
        .where(Entry.slug == slug)
        .options(
            joinedload(Entry.category),
            selectinload(Entry.requirements),
            selectinload(Entry.locations).joinedload(EntryLocation.location),
        )
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@app.get("/api/locations")
def list_locations(session: SessionDep) -> list[LocationWithEntriesOut]:
    locations = session.scalars(
        select(Location)
        .order_by(Location.id)
        .options(selectinload(Location.entries).joinedload(EntryLocation.entry))
    )
    return [LocationWithEntriesOut.model_validate(location) for location in locations]
