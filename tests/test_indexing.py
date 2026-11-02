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
        "entry/certificado-de-notas/where-and-when",
        "location/secretaria/location",
    ]


def test_sections_with_nothing_in_them_are_deleted(entry, index_calls):
    # No requirements and no notes: whatever the index had for them must not keep answering.
    indexing.reindex_entry(None, entry)

    assert index_calls["deleted"] == [
        "entry/certificado-de-notas/requirements",
        "entry/certificado-de-notas/notes",
    ]


def test_removing_an_entry_deletes_its_sections_and_rebuilds_its_places(
    entry, db, index_calls
):
    places = [entry.locations[0].location]
    db.delete(entry)
    db.commit()

    indexing.remove_entry(None, "certificado-de-notas", places)

    assert index_calls["deleted"] == [
        "entry/certificado-de-notas/summary",
        "entry/certificado-de-notas/requirements",
        "entry/certificado-de-notas/where-and-when",
        "entry/certificado-de-notas/notes",
    ]
    assert index_calls["replaced"] == ["location/secretaria/location"]


def test_places_the_entry_was_unlinked_from_are_rebuilt_too(entry, db, index_calls):
    former = Location(name="Caja central", slug="caja-central")
    db.add(former)
    db.commit()

    indexing.reindex_entry(None, entry, former_places=[former])

    # Its document still named the entry; rebuilt, it no longer does.
    assert "location/caja-central/location" in index_calls["replaced"]
    assert "location/secretaria/location" in index_calls["replaced"]


def test_reindexing_a_place_also_rebuilds_where_and_when_of_entries_using_it(
    entry, index_calls
):
    secretaria = entry.locations[0].location

    indexing.reindex_location(None, secretaria)

    # The entry uses it twice but gets one document; its other sections don't mention it.
    assert index_calls["replaced"] == [
        "location/secretaria/location",
        "entry/certificado-de-notas/where-and-when",
    ]


def test_removing_a_place_deletes_its_document(index_calls):
    indexing.remove_location(None, "caja-central")

    assert index_calls["deleted"] == ["location/caja-central/location"]
