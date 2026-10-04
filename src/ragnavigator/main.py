from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ragnavigator.db import get_session
from ragnavigator.models import Category, Entry, EntryLocation
from ragnavigator.schemas import CategoryWithEntriesOut, EntryOut

app = FastAPI(title="ragnavigator")

SessionDep = Annotated[Session, Depends(get_session)]


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
    # Load everything the page shows in one go (a few queries, not one per requirement
    # or location), while the session is still open.
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
    return EntryOut.model_validate(entry)
