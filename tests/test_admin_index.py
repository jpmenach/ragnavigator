import pytest

from ragnavigator import admin as admin_api
from ragnavigator.indexing import IndexStatus
from ragnavigator.models import Category, Entry, Location
from tests.conftest import log_in


@pytest.fixture
def catalog(db) -> None:
    db.add(
        Category(
            name="Académico",
            slug="academico",
            entries=[
                Entry(title="Certificado de notas", slug="certificado-de-notas", summary="."),
                Entry(title="Beca", slug="beca", summary="."),
            ],
        )
    )
    db.add(Location(name="Caja central", slug="caja-central"))
    db.commit()


@pytest.fixture
def status(monkeypatch) -> list[str]:
    """index_status and sync_index without a real index: one stale entry, one orphan.
    Returns the calls made, by name."""
    calls: list[str] = []

    def fake_status(_index, entries, locations):
        calls.append(f"status of {len(entries)} entries, {len(locations)} places")
        return IndexStatus(
            stale_entries={"beca"}, stale_locations=set(), orphans=["entry/x/summary"]
        )

    monkeypatch.setattr(admin_api, "index_status", fake_status)
    monkeypatch.setattr(admin_api, "sync_index", lambda _index, _e, _l: calls.append("sync"))
    return calls


def test_the_index_status_needs_a_login(client, catalog):
    assert client.get("/api/admin/index-status").status_code == 401
    assert client.post("/api/admin/index-status/sync").status_code == 401


def test_the_status_lists_every_entry_and_place(client, admin, catalog, status):
    log_in(client)

    response = client.get("/api/admin/index-status").json()

    assert response == {
        "entries": [
            {"slug": "certificado-de-notas", "name": "Certificado de notas", "up_to_date": True},
            {"slug": "beca", "name": "Beca", "up_to_date": False},
        ],
        "locations": [{"slug": "caja-central", "name": "Caja central", "up_to_date": True}],
        "orphans": 1,
    }
    assert status == ["status of 2 entries, 1 places"]


def test_syncing_runs_on_the_whole_catalog(client, admin, catalog, status):
    log_in(client)

    assert client.post("/api/admin/index-status/sync").status_code == 204

    assert status == ["sync"]
