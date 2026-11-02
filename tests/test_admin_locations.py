"""The places themselves: creating, editing and deleting them. Linking them to an entry is
in test_admin_entry_locations.py."""

import pytest

from ragnavigator.models import Category, Entry, EntryLocation, Location
from tests.conftest import log_in

FIELDS = {
    "name": "Caja central",
    "building": "Edificio Central",
    "floor": "Planta baja",
    "directions": "Al fondo del pasillo principal.",
    "hours": "Lunes a viernes de 8:00 a 16:00.",
}


@pytest.fixture
def places(db) -> None:
    caja = Location(name="Caja", slug="caja-central", building="Central")
    db.add(Location(name="Gabinete médico", slug="gabinete-medico"))
    entry = Entry(
        title="Certificado de notas",
        slug="certificado-de-notas",
        summary="Tus calificaciones.",
        locations=[EntryLocation(location=caja, role="Pago", position=0)],
    )
    db.add(Category(name="Académico", slug="academico", entries=[entry]))
    db.commit()


def place(client, slug: str) -> dict | None:
    locations = {loc["slug"]: loc for loc in client.get("/api/locations").json()}
    return locations.get(slug)


def test_places_need_a_login(client, places):
    assert client.post("/api/admin/locations", json=FIELDS).status_code == 401
    assert client.put("/api/admin/locations/caja-central", json=FIELDS).status_code == 401
    assert client.delete("/api/admin/locations/gabinete-medico").status_code == 401


def test_editing_a_place_saves_it_and_reindexes_it(client, admin, places, location_index_calls):
    log_in(client)

    response = client.put("/api/admin/locations/caja-central", json=FIELDS | {"floor": " "})

    assert response.status_code == 204
    saved = place(client, "caja-central")
    assert {field: saved[field] for field in FIELDS} == FIELDS | {"floor": None}
    # The entries using it keep using it: the slug didn't change.
    assert [link["entry"]["slug"] for link in saved["entries"]] == ["certificado-de-notas"]
    assert location_index_calls["reindexed"] == ["caja-central"]


def test_a_place_needs_a_name(client, admin, places, location_index_calls):
    log_in(client)

    response = client.put("/api/admin/locations/caja-central", json=FIELDS | {"name": ""})

    assert response.status_code == 422
    assert place(client, "caja-central")["name"] == "Caja"
    assert location_index_calls["reindexed"] == []


def test_creating_a_place_makes_its_slug_from_the_name(
    client, admin, places, location_index_calls
):
    log_in(client)

    response = client.post("/api/admin/locations", json=FIELDS | {"name": "Biblioteca Central"})

    assert response.status_code == 201
    assert response.json()["slug"] == "biblioteca-central"
    assert place(client, "biblioteca-central")["entries"] == []
    assert location_index_calls["reindexed"] == ["biblioteca-central"]


def test_a_name_that_makes_an_existing_slug_is_rejected(client, admin, places):
    log_in(client)

    response = client.post("/api/admin/locations", json=FIELDS | {"name": "Caja Central"})

    assert response.status_code == 409


def test_an_unused_place_can_be_deleted(client, admin, places, location_index_calls):
    log_in(client)

    assert client.delete("/api/admin/locations/gabinete-medico").status_code == 204

    assert place(client, "gabinete-medico") is None
    assert location_index_calls["removed"] == ["gabinete-medico"]


def test_a_place_in_use_cant_be_deleted(client, admin, places, location_index_calls):
    log_in(client)

    assert client.delete("/api/admin/locations/caja-central").status_code == 409

    assert place(client, "caja-central") is not None
    assert location_index_calls["removed"] == []


def test_an_unknown_place_is_a_404(client, admin):
    log_in(client)
    assert client.put("/api/admin/locations/no-existe", json=FIELDS).status_code == 404
    assert client.delete("/api/admin/locations/no-existe").status_code == 404
