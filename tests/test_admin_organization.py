import pytest

from ragnavigator.models import Organization
from tests.conftest import log_in

URL = "/api/admin/organization"


@pytest.fixture
def organization(db) -> None:
    db.add(Organization(name="Universidad", primary_color="#1d4f8c"))
    db.commit()


def test_editing_the_organization_needs_a_login(client, organization):
    assert client.put(URL, json={"name": "U", "primary_color": "#000000"}).status_code == 401


def test_saving_changes_what_the_site_reads(client, admin, organization):
    log_in(client)

    response = client.put(URL, json={"name": " Universidad Monteluz ", "primary_color": "#A31F34"})

    assert response.status_code == 204
    assert client.get("/api/organization").json() == {
        "name": "Universidad Monteluz",
        "primary_color": "#A31F34",
    }


@pytest.mark.parametrize("color", ["red", "#12345", "#1d4f8c00", "x#1d4f8c", "#gggggg"])
def test_only_a_hex_color_is_accepted(client, admin, organization, color):
    log_in(client)

    response = client.put(URL, json={"name": "Universidad", "primary_color": color})

    # A 422, not the model's ValueError as a 500; and nothing changes.
    assert response.status_code == 422
    assert client.get("/api/organization").json()["primary_color"] == "#1d4f8c"


def test_a_name_is_required(client, admin, organization):
    log_in(client)
    assert client.put(URL, json={"name": " ", "primary_color": "#000000"}).status_code == 422
