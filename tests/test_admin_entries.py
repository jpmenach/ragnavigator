import pytest

from ragnavigator.models import Category, Entry
from tests.conftest import log_in

TEXT = {
    "title": "Certificado de notas",
    "summary": "Documento oficial con tus calificaciones.",
    "cost": "60 bolivianos (Bs)",
    "duration": "2 días hábiles",
    "notes": None,
}


@pytest.fixture
def entry(db) -> Entry:
    entry = Entry(title="Certificado", slug="certificado-de-notas", summary="Antes", cost="50 Bs")
    db.add(Category(name="Académico", slug="academico", entries=[entry]))
    db.commit()
    return entry


def test_editing_needs_a_login(client, entry):
    response = client.put("/api/admin/entries/certificado-de-notas", json=TEXT)
    assert response.status_code == 401


def test_saving_replaces_the_text_and_the_site_shows_it(client, admin, entry):
    log_in(client)

    response = client.put("/api/admin/entries/certificado-de-notas", json=TEXT)

    assert response.status_code == 204
    page = client.get("/api/entries/certificado-de-notas").json()
    assert {field: page[field] for field in TEXT} == TEXT


def test_saving_reindexes_the_entry(client, admin, entry, reindexed):
    log_in(client)

    client.put("/api/admin/entries/certificado-de-notas", json=TEXT)

    assert reindexed == ["certificado-de-notas"]


def test_blank_optional_fields_are_saved_as_not_set(client, admin, entry):
    log_in(client)

    client.put("/api/admin/entries/certificado-de-notas", json=TEXT | {"cost": "  "})

    assert client.get("/api/entries/certificado-de-notas").json()["cost"] is None


def test_title_and_summary_are_required(client, admin, entry, reindexed):
    log_in(client)

    response = client.put("/api/admin/entries/certificado-de-notas", json=TEXT | {"title": " "})

    assert response.status_code == 422
    assert client.get("/api/entries/certificado-de-notas").json()["title"] == "Certificado"
    assert reindexed == []


def test_an_unknown_entry_is_a_404(client, admin):
    log_in(client)
    assert client.put("/api/admin/entries/no-existe", json=TEXT).status_code == 404
