from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ragnavigator.actions import actions_for
from ragnavigator.assistant import ask
from ragnavigator.db import get_session
from ragnavigator.models import Category, Entry, EntryLocation, Location, Organization
from ragnavigator.pdf import requirements_pdf
from ragnavigator.schemas import (
    AskIn,
    AskOut,
    CategoryWithEntriesOut,
    EntryOut,
    LocationWithEntriesOut,
    OrganizationOut,
    SourceOut,
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


@app.post("/api/ask")
def ask_question(body: AskIn) -> AskOut:
    result = ask(body.question)
    if not result.grounded:
        # Retrieval always returns its closest chunks, even for an unrelated question. Only
        # sources that backed an answer are worth showing, or navigating to.
        return AskOut(answer="", grounded=False, sources=[], actions=[])
    sources = [
        SourceOut(
            kind=chunk.metadata["kind"],
            slug=chunk.metadata["slug"],
            section=chunk.metadata["section"],
            route=chunk.metadata["route"],
            score=chunk.score,
        )
        for chunk in result.sources
    ]
    return AskOut(
        answer=result.text, grounded=True, sources=sources, actions=actions_for(sources)
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


# In production, FastAPI also serves the built frontend (npm run build), so the whole app is
# one process. Registered last: routes match in order, so every /api route wins over the
# catch-all below. In development Vite serves the frontend and this folder may not exist.
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str) -> FileResponse:
        # A typo'd API call should be a 404, not the HTML page with a 200.
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        # Every other path is a page the frontend's router knows (/entries/…, /locations),
        # so the same index.html is returned and React Router takes it from there.
        return FileResponse(FRONTEND_DIST / "index.html")
