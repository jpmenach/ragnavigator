import pytest
from ragstarter.core.query import Answer

from ragnavigator import main
from ragnavigator.models import UnansweredQuestion
from tests.conftest import log_in


@pytest.fixture
def assistant(monkeypatch) -> None:
    """The assistant without the model: questions about the cafeteria aren't in the
    catalog, everything else is."""

    def fake_ask(question: str) -> Answer:
        if "comedor" in question:
            return Answer(text="", sources=[], grounded=False)
        return Answer(text="Cuesta 50 Bs.", sources=[], grounded=True)

    monkeypatch.setattr(main, "ask", fake_ask)


def test_a_question_the_catalog_cant_answer_is_kept(client, db, assistant):
    client.post("/api/ask", json={"question": "  ¿Hay comedor?  "})
    client.post("/api/ask", json={"question": "¿Cuánto cuesta el certificado?"})

    # Only the unanswered one, trimmed.
    assert [q.question for q in db.query(UnansweredQuestion)] == ["¿Hay comedor?"]


def test_the_admin_lists_them_newest_first_with_a_utc_time(client, db, admin, assistant):
    client.post("/api/ask", json={"question": "¿Hay comedor?"})
    client.post("/api/ask", json={"question": "¿A qué hora abre el comedor?"})
    log_in(client)

    questions = client.get("/api/admin/unanswered").json()

    assert [q["question"] for q in questions] == ["¿A qué hora abre el comedor?", "¿Hay comedor?"]
    # Marked as UTC, so the browser shows it in local time instead of hours off.
    assert questions[0]["asked_at"].endswith("Z")


def test_a_question_can_be_dismissed(client, db, admin, assistant):
    client.post("/api/ask", json={"question": "¿Hay comedor?"})
    log_in(client)
    question_id = client.get("/api/admin/unanswered").json()[0]["id"]

    assert client.delete(f"/api/admin/unanswered/{question_id}").status_code == 204

    assert client.get("/api/admin/unanswered").json() == []
    assert client.delete(f"/api/admin/unanswered/{question_id}").status_code == 404


def test_the_questions_need_a_login(client, db):
    assert client.get("/api/admin/unanswered").status_code == 401
    assert client.delete("/api/admin/unanswered/1").status_code == 401
