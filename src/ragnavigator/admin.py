"""The admin API: logging in and out, and the guard every admin route goes through.

The browser keeps the session token in a cookie it can't read from JavaScript (HttpOnly)
and only sends to these routes, from this site (Path, SameSite=Strict). The database keeps
the token's hash, so logging out, or deleting the row, ends the session on the spot.
"""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import joinedload

from ragnavigator.auth import (
    DUMMY_PASSWORD_HASH,
    SESSION_LIFETIME,
    hash_token,
    new_session_token,
    utcnow,
    verify_password,
)
from ragnavigator.db import SessionDep
from ragnavigator.models import AdminSession, AdminUser, Entry
from ragnavigator.schemas import AdminOut, EntryTextIn, LoginIn

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


@router.put("/entries/{slug}", status_code=204)
def update_entry_text(
    slug: str, body: EntryTextIn, session: SessionDep, admin: CurrentAdmin
) -> None:
    entry = session.scalar(select(Entry).where(Entry.slug == slug))
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    for field, value in body.model_dump().items():
        # A blank optional field means "not set", the same as leaving it out of the catalog.
        setattr(entry, field, value or None)
    session.commit()
