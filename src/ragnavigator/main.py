from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ragnavigator.db import get_session
from ragnavigator.models import Entry, EntryLocation
from ragnavigator.schemas import EntryOut

app = FastAPI(title="ragnavigator")

SessionDep = Annotated[Session, Depends(get_session)]


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
