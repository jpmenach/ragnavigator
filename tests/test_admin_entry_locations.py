import pytest

from ragnavigator import admin as admin_api
from ragnavigator.models import Category, Entry, EntryLocation, Location
from tests.conftest import log_in

URL = "/api/admin/entries/certificado-de-notas/locations"


@pytest.fixture
def entry(db) -> Entry:
    secretaria = Location(name="Secretaría", slug="secretaria")
    db.add(Location(name="Caja central", slug="caja-central"))
    entry = Entry(
        title="Certificado de notas",
        slug="certificado-de-notas",
        summary="Tus calificaciones.",
        locations=[
            EntryLocation(location=secretaria, role="Solicitud", position=0),
            EntryLocation(location=secretaria, role="Entrega", position=1),
        ],
    )
    db.add(Category(name="Académico", slug="academico", entries=[entry]))
    db.commit()
    return entry


def places(client) -> list[tuple[str, str]]:
    links = client.get("/api/entries/certificado-de-notas").json()["locations"]
    return [(link["location"]["slug"], link["role"]) for link in links]


def test_editing_places_needs_a_login(client, entry):
    assert client.put(URL, json=[]).status_code == 401


def test_saving_replaces_the_places_in_the_order_sent(client, admin, entry, reindexed):
    log_in(client)
    # One link kept exactly as it was (same key), one new, one dropped, and reordered.
    new_list = [
        {"location": "caja-central", "role": "Pago"},
        {"location": "secretaria", "role": "Solicitud"},
    ]

    assert client.put(URL, json=new_list).status_code == 204

    assert places(client) == [("caja-central", "Pago"), ("secretaria", "Solicitud")]
    assert reindexed == ["certificado-de-notas"]


def test_a_place_taken_off_is_reindexed_too(client, admin, entry, monkeypatch):
    log_in(client)
    rebuilt: list[str] = []
    monkeypatch.setattr(
        admin_api,
        "reindex_entry",
        lambda _index, _entry, former_places: rebuilt.extend(p.slug for p in former_places),
    )

    client.put(URL, json=[{"location": "caja-central", "role": "Pago"}])

    # Secretaría's document still says what's done there for this entry.
    assert "secretaria" in rebuilt


def test_the_place_page_shows_what_is_done_there(client, admin, entry):
    log_in(client)

    client.put(URL, json=[{"location": "caja-central", "role": "Pago"}])

    locations = {loc["slug"]: loc for loc in client.get("/api/locations").json()}
    assert [link["role"] for link in locations["caja-central"]["entries"]] == ["Pago"]
    assert locations["secretaria"]["entries"] == []


def test_an_unknown_place_is_rejected(client, admin, entry, reindexed):
    log_in(client)

    response = client.put(URL, json=[{"location": "no-existe", "role": "Pago"}])

    assert response.status_code == 422
    assert places(client) == [("secretaria", "Solicitud"), ("secretaria", "Entrega")]
    assert reindexed == []


def test_the_same_place_and_role_twice_is_rejected(client, admin, entry):
    log_in(client)
    twice = {"location": "caja-central", "role": "Pago"}

    assert client.put(URL, json=[twice, twice]).status_code == 422


def test_a_role_is_required(client, admin, entry):
    log_in(client)

    response = client.put(URL, json=[{"location": "caja-central", "role": " "}])

    assert response.status_code == 422


def test_places_of_an_unknown_entry_are_a_404(client, admin):
    log_in(client)
    assert client.put("/api/admin/entries/no-existe/locations", json=[]).status_code == 404
