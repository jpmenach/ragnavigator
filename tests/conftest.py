from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from ragnavigator.auth import hash_password
from ragnavigator.db import create_sqlite_engine, get_session
from ragnavigator.main import app
from ragnavigator.models import AdminUser, Base

ADMIN_PASSWORD = "a-long-test-password"


@pytest.fixture
def db(tmp_path) -> Iterator[Session]:
    """A fresh database per test, in pytest's temporary folder; the real one is never touched."""
    engine = create_sqlite_engine(tmp_path / "test.db")
    # The tables straight from the models: the migrations are checked by running them.
    Base.metadata.create_all(engine)

    def get_test_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = get_test_session
    with Session(engine) as session:
        yield session
    app.dependency_overrides.clear()
    engine.dispose()


@pytest.fixture
def client(db) -> TestClient:
    # https, or the client would keep the Secure session cookie to itself.
    return TestClient(app, base_url="https://testserver")


@pytest.fixture
def admin(db) -> AdminUser:
    admin = AdminUser(username="ana", password_hash=hash_password(ADMIN_PASSWORD))
    db.add(admin)
    db.commit()
    return admin


def log_in(client, username="ana", password=ADMIN_PASSWORD):
    return client.post("/api/admin/login", json={"username": username, "password": password})
