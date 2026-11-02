import pytest

from ragnavigator.models import Category, Entry
from tests.conftest import log_in

FIELDS = {
    "category": "academico",
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
    db.add(Category(name="Titulación", slug="titulacion"))
    db.commit()
    return entry


def entries_in(client, category_slug: str) -> list[str]:
    categories = client.get("/api/categories").json()
    category = next(c for c in categories if c["slug"] == category_slug)
    return [entry["slug"] for entry in category["entries"]]


def test_editing_needs_a_login(client, entry):
    response = client.put("/api/admin/entries/certificado-de-notas", json=FIELDS)
    assert response.status_code == 401


def test_saving_replaces_the_text_and_the_site_shows_it(client, admin, entry):
    log_in(client)

    response = client.put("/api/admin/entries/certificado-de-notas", json=FIELDS)

    assert response.status_code == 204
    page = client.get("/api/entries/certificado-de-notas").json()
    assert {field: page[field] for field in FIELDS if field != "category"} == {
        field: value for field, value in FIELDS.items() if field != "category"
    }


def test_saving_reindexes_the_entry(client, admin, entry, reindexed):
    log_in(client)

    client.put("/api/admin/entries/certificado-de-notas", json=FIELDS)

    assert reindexed == ["certificado-de-notas"]


def test_blank_optional_fields_are_saved_as_not_set(client, admin, entry):
    log_in(client)

    client.put("/api/admin/entries/certificado-de-notas", json=FIELDS | {"cost": "  "})

    assert client.get("/api/entries/certificado-de-notas").json()["cost"] is None


def test_title_and_summary_are_required(client, admin, entry, reindexed):
    log_in(client)

    response = client.put("/api/admin/entries/certificado-de-notas", json=FIELDS | {"title": " "})

    assert response.status_code == 422
    assert client.get("/api/entries/certificado-de-notas").json()["title"] == "Certificado"
    assert reindexed == []


def test_an_unknown_entry_is_a_404(client, admin):
    log_in(client)
    assert client.put("/api/admin/entries/no-existe", json=FIELDS).status_code == 404


def test_entries_need_a_login_to_create_or_delete(client, entry):
    assert client.post("/api/admin/entries", json=FIELDS).status_code == 401
    assert client.delete("/api/admin/entries/certificado-de-notas").status_code == 401


def test_saving_can_move_an_entry_to_another_category(client, admin, entry, reindexed):
    log_in(client)

    client.put("/api/admin/entries/certificado-de-notas", json=FIELDS | {"category": "titulacion"})

    assert entries_in(client, "titulacion") == ["certificado-de-notas"]
    assert entries_in(client, "academico") == []
    # Its summary document says which category it's in.
    assert reindexed == ["certificado-de-notas"]


def test_an_unknown_category_is_rejected(client, admin, entry):
    log_in(client)

    response = client.put(
        "/api/admin/entries/certificado-de-notas", json=FIELDS | {"category": "no-existe"}
    )

    assert response.status_code == 422
    assert entries_in(client, "academico") == ["certificado-de-notas"]


def test_creating_an_entry_makes_its_slug_from_the_title(client, admin, entry, reindexed):
    log_in(client)

    response = client.post(
        "/api/admin/entries", json=FIELDS | {"title": "Beca de excelencia académica"}
    )

    assert response.status_code == 201
    assert response.json()["slug"] == "beca-de-excelencia-academica"
    page = client.get("/api/entries/beca-de-excelencia-academica").json()
    assert (page["category"]["slug"], page["requirements"], page["locations"]) == (
        "academico",
        [],
        [],
    )
    assert reindexed == ["beca-de-excelencia-academica"]


def test_a_title_that_makes_an_existing_slug_is_rejected(client, admin, entry):
    log_in(client)

    response = client.post("/api/admin/entries", json=FIELDS | {"title": "Certificado de NOTAS"})

    assert response.status_code == 409
    assert entries_in(client, "academico") == ["certificado-de-notas"]


def test_deleting_an_entry_takes_it_off_the_site_and_the_index(
    client, admin, entry, removed_from_index
):
    log_in(client)

    assert client.delete("/api/admin/entries/certificado-de-notas").status_code == 204

    assert client.get("/api/entries/certificado-de-notas").status_code == 404
    assert removed_from_index == ["certificado-de-notas"]
