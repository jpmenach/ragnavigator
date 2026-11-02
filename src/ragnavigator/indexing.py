"""Turn the catalog into documents for ragstarter's index: one per entry section, one per
location.

Each document carries where it lives on the site (`route`, with the section's #anchor), so
an answer built from it can take the user there. That metadata is excluded from the
embedding: it's a label, not content. What the search needs to tell entries apart, their
title, goes in the text instead.

Run from the repo root (after seeding) with:
    uv run python -m ragnavigator.indexing
"""

from collections.abc import Iterable

from llama_index.core import Document, VectorStoreIndex
from ragstarter.core.ingest import (
    build_index_from_documents,
    delete_documents,
    replace_documents,
)
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from ragnavigator.db import STORAGE_DIR, engine
from ragnavigator.models import Entry, EntryLocation, Location

INDEX_DIR = STORAGE_DIR / "chroma"

# Every section an entry can have a document for. Only sections with content get one, so
# an entry may have fewer: re-indexing deletes the ones it no longer has.
ENTRY_SECTIONS = ("summary", "requirements", "where-and-when", "notes")


def entry_documents(entry: Entry) -> list[Document]:
    route = f"/entries/{entry.slug}"
    # One heading per document, naming the entry and the section: ragstarter splits at
    # every heading, so "# Title" + "## Requisitos" would leave the requirements chunk
    # without the entry's name, and "Fotocopia de CI" would match every entry equally.
    summary = [
        f"# {entry.title}",
        f"Categoría: {entry.category.name}.",
        entry.summary,
    ]
    if entry.cost:
        summary.append(f"Costo: {entry.cost}.")
    if entry.duration:
        summary.append(f"Duración: {entry.duration}.")
    documents = [_document("\n".join(summary), "entry", entry.slug, "summary", route)]

    # Like notes, the lists get a document only when they have something in them. A new
    # entry has neither yet, and an empty "requisitos" document would still match questions
    # about requirements and send people to an empty section.
    if entry.requirements:
        requirements = [f"# {entry.title}: requisitos"]
        for number, requirement in enumerate(entry.requirements, start=1):
            line = f"{number}. {requirement.name}"
            if requirement.description:
                line += f": {requirement.description}"
            requirements.append(line)
        documents.append(
            _document(
                "\n".join(requirements),
                "entry",
                entry.slug,
                "requirements",
                f"{route}#requirements",
            )
        )

    if entry.locations:
        places = [f"# {entry.title}: dónde y cuándo"]
        for link in entry.locations:
            places.append(f"- {link.role}: {_describe_location(link.location)}")
        documents.append(
            _document(
                "\n".join(places),
                "entry",
                entry.slug,
                "where-and-when",
                f"{route}#where-and-when",
            )
        )

    if entry.notes:
        documents.append(
            _document(
                f"# {entry.title}: notas\n{entry.notes}",
                "entry",
                entry.slug,
                "notes",
                f"{route}#notes",
            )
        )
    return documents


def location_document(location: Location) -> Document:
    lines = [f"# {location.name}", _describe_location(location)]
    # What's done here, grouped by role ("Pago: Certificado de notas, Cambio de carrera").
    by_role: dict[str, list[str]] = {}
    for link in location.entries:
        by_role.setdefault(link.role, []).append(link.entry.title)
    lines += [f"{role}: {', '.join(titles)}." for role, titles in by_role.items()]
    return _document(
        "\n".join(lines),
        "location",
        location.slug,
        "location",
        f"/locations#{location.slug}",
    )


def build_catalog_index() -> int:
    with Session(engine) as session:
        entries = session.scalars(
            select(Entry).options(
                joinedload(Entry.category),
                selectinload(Entry.requirements),
                selectinload(Entry.locations).joinedload(EntryLocation.location),
            )
        ).all()
        locations = session.scalars(
            select(Location).options(
                selectinload(Location.entries).joinedload(EntryLocation.entry)
            )
        ).all()
        documents = [doc for entry in entries for doc in entry_documents(entry)]
        documents += [location_document(location) for location in locations]

    build_index_from_documents(documents, INDEX_DIR)
    return len(documents)


def reindex_entry(
    index: VectorStoreIndex, entry: Entry, former_places: Iterable[Location] = ()
) -> None:
    """Bring a live index up to date with an edited entry, without rebuilding the rest.

    The entry's places are included: their documents name the entry, so a new title has to
    reach them too. So are `former_places`, the ones it was just unlinked from: their
    documents still name it until they're rebuilt.
    """
    documents = entry_documents(entry)
    # A place can appear twice for one entry (request and pick up at the same counter),
    # and a former place may still be linked under another role.
    places = {location.slug: location for location in former_places}
    places |= {link.location.slug: link.location for link in entry.locations}
    documents += [location_document(location) for location in places.values()]

    current = {document.doc_id for document in documents}
    delete_documents(index, [id_ for id_ in _entry_document_ids(entry.slug) if id_ not in current])
    replace_documents(index, documents)


def remove_entry(index: VectorStoreIndex, slug: str, places: list[Location]) -> None:
    """Take a deleted entry out of a live index. `places` are the ones it was linked to:
    their documents named it, so they're rebuilt without it."""
    delete_documents(index, _entry_document_ids(slug))
    if places:
        replace_documents(index, [location_document(location) for location in places])


def reindex_location(index: VectorStoreIndex, location: Location) -> None:
    """Bring a live index up to date with an edited (or new) place: its own document, and
    those of the entries that use it, whose "where and when" describes it too."""
    documents = [location_document(location)]
    # An entry can use the same place twice (request and pick up there).
    entries = {link.entry.slug: link.entry for link in location.entries}
    for entry in entries.values():
        documents += [
            document
            for document in entry_documents(entry)
            if document.metadata["section"] == "where-and-when"
        ]
    replace_documents(index, documents)


def remove_location(index: VectorStoreIndex, slug: str) -> None:
    """Take a deleted place out of a live index. Only unused places can be deleted, so no
    entry's document mentions it."""
    delete_documents(index, [_document_id("location", slug, "location")])


def _describe_location(location: Location) -> str:
    parts = [location.name]
    place = ", ".join(part for part in (location.building, location.floor) if part)
    if place:
        parts.append(f"({place})")
    text = " ".join(parts) + "."
    if location.directions:
        text += f" {location.directions}"
    if location.hours:
        text += f" Horario: {location.hours}"
    return text


def _document(text: str, kind: str, slug: str, section: str, route: str) -> Document:
    metadata = {"kind": kind, "slug": slug, "section": section, "route": route}
    return Document(
        # Stable, so an edit can replace exactly this document in the index.
        id_=_document_id(kind, slug, section),
        text=text,
        metadata=metadata,
        excluded_embed_metadata_keys=list(metadata),
    )



def _entry_document_ids(slug: str) -> list[str]:
    return [_document_id("entry", slug, section) for section in ENTRY_SECTIONS]


def _document_id(kind: str, slug: str, section: str) -> str:
    return f"{kind}/{slug}/{section}"


if __name__ == "__main__":
    count = build_catalog_index()
    print(f"Indexed {count} documents into {INDEX_DIR}")
