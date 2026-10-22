import pytest

from ragnavigator import indexing
from ragnavigator.models import Category, Entry, EntryLocation, Location


@pytest.fixture
def index_calls(monkeypatch) -> dict[str, list[str]]:
    """What reindex_entry asks ragstarter to delete and replace, by document ID."""
    calls: dict[str, list[str]] = {"deleted": [], "replaced": []}
    monkeypatch.setattr(
        indexing, "delete_documents", lambda _index, ids: calls["deleted"].extend(ids)
    )
    monkeypatch.setattr(
        indexing,
        "replace_documents",
        lambda _index, documents: calls["replaced"].extend(d.doc_id for d in documents),
    )
    return calls


@pytest.fixture
def entry(db) -> Entry:
    counter = Location(name="Secretaría", slug="secretaria")
    entry = Entry(
        title="Certificado de notas",
        slug="certificado-de-notas",
        summary="Tus calificaciones.",
        # Requested and picked up at the same counter: two links, one place.
        locations=[
            EntryLocation(location=counter, role="Solicitud", position=1),
            EntryLocation(location=counter, role="Entrega", position=2),
        ],
    )
    db.add(Category(name="Académico", slug="academico", entries=[entry]))
    db.commit()
    return entry


def test_reindexing_replaces_the_entry_sections_and_its_places(entry, index_calls):
    indexing.reindex_entry(None, entry)

    assert index_calls["replaced"] == [
        "entry/certificado-de-notas/summary",
        "entry/certificado-de-notas/requirements",
        "entry/certificado-de-notas/where-and-when",
        "location/secretaria/location",
    ]


def test_a_section_the_entry_no_longer_has_is_deleted(entry, index_calls):
    # No notes: whatever the index had for them must not keep answering.
    indexing.reindex_entry(None, entry)

    assert index_calls["deleted"] == ["entry/certificado-de-notas/notes"]
