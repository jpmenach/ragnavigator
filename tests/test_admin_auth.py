from datetime import timedelta

from sqlalchemy import select

from ragnavigator.admin import COOKIE_NAME
from ragnavigator.auth import hash_token, new_session_token, utcnow
from ragnavigator.models import AdminSession
from tests.conftest import log_in


def test_me_needs_a_login(client):
    assert client.get("/api/admin/me").status_code == 401


def test_login_sets_a_locked_down_cookie(client, admin):
    response = log_in(client)

    assert response.status_code == 200
    assert response.json() == {"username": "ana"}
    cookie = response.headers["set-cookie"]
    for flag in ("HttpOnly", "Secure", "SameSite=strict", "Path=/api/admin"):
        assert flag in cookie
    assert client.get("/api/admin/me").json() == {"username": "ana"}


def test_wrong_password_and_unknown_user_look_the_same(client, admin):
    wrong_password = log_in(client, password="not-the-password")
    unknown_user = log_in(client, username="nobody")

    assert wrong_password.status_code == unknown_user.status_code == 401
    assert wrong_password.json() == unknown_user.json()
    assert COOKIE_NAME not in client.cookies


def test_only_the_token_hash_is_stored(client, admin, db):
    token = log_in(client).cookies[COOKIE_NAME]

    stored = db.scalars(select(AdminSession.token_hash)).all()
    assert stored == [hash_token(token)]


def test_logout_ends_the_session_on_the_server(client, admin):
    token = log_in(client).cookies[COOKIE_NAME]

    assert client.post("/api/admin/logout").status_code == 204
    # Even someone who kept a copy of the cookie is out: the session row is gone.
    client.cookies.set(COOKIE_NAME, token)
    assert client.get("/api/admin/me").status_code == 401


def test_an_expired_session_is_rejected_and_cleared_at_the_next_login(client, admin, db):
    token = new_session_token()
    db.add(
        AdminSession(
            admin=admin,
            token_hash=hash_token(token),
            created_at=utcnow() - timedelta(hours=9),
            expires_at=utcnow() - timedelta(hours=1),
        )
    )
    db.commit()

    client.cookies.set(COOKIE_NAME, token)
    assert client.get("/api/admin/me").status_code == 401

    log_in(client)
    remaining = db.scalars(select(AdminSession.token_hash)).all()
    assert hash_token(token) not in remaining


def test_deleting_an_admin_deletes_their_sessions(client, admin, db):
    log_in(client)

    db.delete(admin)
    db.commit()

    assert db.scalars(select(AdminSession)).all() == []
    assert client.get("/api/admin/me").status_code == 401
