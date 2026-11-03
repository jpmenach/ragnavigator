from types import SimpleNamespace

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


def fake_index(documents) -> SimpleNamespace:
    """An index holding these documents, one chunk each, as get_nodes() returns them."""
    nodes = [SimpleNamespace(ref_doc_id=d.doc_id, metadata=dict(d.metadata)) for d in documents]
    return SimpleNamespace(vector_store=SimpleNamespace(get_nodes=lambda _ids: nodes))


def indexed_now(entry) -> list:
    """What indexing the catalog produces right now: the entry and its one place."""
    return indexing.entry_documents(entry) + [
        indexing.location_document(entry.locations[0].location)
    ]


def test_an_index_built_from_the_catalog_is_up_to_date(entry):
    index = fake_index(indexed_now(entry))

    status = indexing.index_status(index, [entry], [entry.locations[0].location])

    assert (status.stale_entries, status.stale_locations, status.orphans) == (set(), set(), [])


def test_an_edit_the_index_missed_makes_the_entry_stale(entry, db):
    index = fake_index(indexed_now(entry))
    entry.summary = "Otro resumen."
    db.commit()

    status = indexing.index_status(index, [entry], [entry.locations[0].location])

    assert status.stale_entries == {"certificado-de-notas"}
    assert status.stale_locations == set()


def test_a_document_indexed_without_a_hash_reads_as_stale(entry):
    # As in an index built before hashes existed.
    documents = indexed_now(entry)
    del documents[0].metadata["content_hash"]

    status = indexing.index_status(fake_index(documents), [entry], [entry.locations[0].location])

    assert status.stale_entries == {"certificado-de-notas"}


def test_a_section_the_entry_no_longer_has_makes_it_stale(entry):
    leftover = indexing._document(
        "# Certificado de notas: notas\nVieja.", "entry", "certificado-de-notas", "notes", "/"
    )

    status = indexing.index_status(
        fake_index(indexed_now(entry) + [leftover]), [entry], [entry.locations[0].location]
    )

    assert status.stale_entries == {"certificado-de-notas"}


def test_documents_of_deleted_entries_are_orphans(entry):
    gone = indexing._document("# Beca", "entry", "beca", "summary", "/entries/beca")

    status = indexing.index_status(
        fake_index(indexed_now(entry) + [gone]), [entry], [entry.locations[0].location]
    )

    assert status.orphans == ["entry/beca/summary"]
    assert status.stale_entries == set()


def test_syncing_reindexes_only_what_is_stale_and_deletes_orphans(entry, db, index_calls):
    gone = indexing._document("# Beca", "entry", "beca", "summary", "/entries/beca")
    index = fake_index(indexed_now(entry) + [gone])
    place = entry.locations[0].location
    place.hours = "Lunes a viernes."
    db.commit()

    indexing.sync_index(index, [entry], [place])

    # The place changed and the entry's "where and when" describes it, so both are stale.
    assert "location/secretaria/location" in index_calls["replaced"]
    assert "entry/certificado-de-notas/where-and-when" in index_calls["replaced"]
    assert "entry/beca/summary" in index_calls["deleted"]
