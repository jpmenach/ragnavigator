import pytest

from ragnavigator.models import Category, Entry
from ragnavigator.slugs import slugify
from tests.conftest import log_in


@pytest.fixture
def categories(db) -> list[Category]:
    full = Category(
        name="Titulación",
        slug="titulacion",
        entries=[
            Entry(title="Diploma", slug="diploma", summary="."),
            Entry(title="Legalización", slug="legalizacion", summary="."),
        ],
    )
    empty = Category(name="Deportes", slug="deportes")
    db.add_all([full, empty])
    db.commit()
    return [full, empty]


def category_names(client) -> list[str]:
    return [category["name"] for category in client.get("/api/categories").json()]


@pytest.mark.parametrize(
    ("name", "slug"),
    [
        ("Bienestar Universitario", "bienestar-universitario"),
        ("Titulación y diplomas", "titulacion-y-diplomas"),
        ("  Año académico / 2026 ", "ano-academico-2026"),
    ],
)
def test_slugs_drop_accents_and_symbols(name, slug):
    assert slugify(name) == slug


def test_categories_need_a_login(client, categories):
    assert client.post("/api/admin/categories", json={"name": "Becas"}).status_code == 401
    assert client.put("/api/admin/categories/deportes", json={"name": "X"}).status_code == 401
    assert client.delete("/api/admin/categories/deportes").status_code == 401


def test_creating_a_category_makes_its_slug_from_the_name(client, admin, categories):
    log_in(client)

    response = client.post("/api/admin/categories", json={"name": " Becas y ayudas "})

    assert response.status_code == 201
    assert response.json() == {"name": "Becas y ayudas", "slug": "becas-y-ayudas"}
    assert category_names(client)[-1] == "Becas y ayudas"


def test_a_name_that_makes_an_existing_slug_is_rejected(client, admin, categories):
    log_in(client)

    response = client.post("/api/admin/categories", json={"name": "TITULACIÓN"})

    assert response.status_code == 409
    assert category_names(client) == ["Titulación", "Deportes"]


def test_renaming_keeps_the_slug_and_reindexes_the_entries(
    client, admin, categories, reindexed
):
    log_in(client)

    response = client.put("/api/admin/categories/titulacion", json={"name": "Títulos"})

    assert response.status_code == 204
    renamed = client.get("/api/categories").json()[0]
    assert (renamed["name"], renamed["slug"]) == ("Títulos", "titulacion")
    assert reindexed == ["diploma", "legalizacion"]


def test_an_empty_category_can_be_deleted(client, admin, categories):
    log_in(client)

    assert client.delete("/api/admin/categories/deportes").status_code == 204
    assert category_names(client) == ["Titulación"]


def test_a_category_with_entries_is_kept(client, admin, categories):
    log_in(client)

    assert client.delete("/api/admin/categories/titulacion").status_code == 409
    assert category_names(client) == ["Titulación", "Deportes"]


def test_an_unknown_category_is_a_404(client, admin):
    log_in(client)

    assert client.put("/api/admin/categories/no-existe", json={"name": "X"}).status_code == 404
    assert client.delete("/api/admin/categories/no-existe").status_code == 404
