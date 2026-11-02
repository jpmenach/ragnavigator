import pytest

from ragnavigator.models import Category, Entry, Requirement
from tests.conftest import log_in

URL = "/api/admin/entries/certificado-de-notas/requirements"


@pytest.fixture
def entry(db) -> Entry:
    entry = Entry(
        title="Certificado de notas",
        slug="certificado-de-notas",
        summary="Tus calificaciones.",
        requirements=[
            Requirement(name="Carnet", description=None, position=0),
            Requirement(name="Boleta de pago", description="De caja central", position=1),
        ],
    )
    db.add(Category(name="Académico", slug="academico", entries=[entry]))
    db.commit()
    return entry


def requirements(client) -> list[dict]:
    return client.get("/api/entries/certificado-de-notas").json()["requirements"]


def test_editing_requirements_needs_a_login(client, entry):
    assert client.put(URL, json=[]).status_code == 401


def test_saving_replaces_the_list_in_the_order_sent(client, admin, entry, reindexed):
    log_in(client)
    # Reordered, one edited, one added: all in a single save.
    new_list = [
        {"name": "Boleta de pago", "description": "De caja central"},
        {"name": "Carnet de identidad", "description": None},
        {"name": "Matrícula vigente", "description": "Del semestre actual"},
    ]

    assert client.put(URL, json=new_list).status_code == 204

    assert requirements(client) == new_list
    assert reindexed == ["certificado-de-notas"]


def test_an_empty_list_removes_every_requirement(client, admin, entry, db):
    log_in(client)

    client.put(URL, json=[])

    assert requirements(client) == []
    # The old rows are deleted, not just unlinked.
    assert db.query(Requirement).count() == 0


def test_a_blank_description_is_saved_as_not_set(client, admin, entry):
    log_in(client)

    client.put(URL, json=[{"name": " Carnet ", "description": "  "}])

    assert requirements(client) == [{"name": "Carnet", "description": None}]


def test_a_requirement_needs_a_name(client, admin, entry, reindexed):
    log_in(client)

    response = client.put(URL, json=[{"name": "Carnet"}, {"name": " "}])

    assert response.status_code == 422
    assert [r["name"] for r in requirements(client)] == ["Carnet", "Boleta de pago"]
    assert reindexed == []


def test_the_list_has_a_limit(client, admin, entry):
    log_in(client)
    assert client.put(URL, json=[{"name": "Carnet"}] * 51).status_code == 422


def test_requirements_of_an_unknown_entry_are_a_404(client, admin):
    log_in(client)
    assert client.put("/api/admin/entries/no-existe/requirements", json=[]).status_code == 404
