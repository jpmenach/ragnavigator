from collections.abc import Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session

STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"
DB_PATH = STORAGE_DIR / "catalog.db"


def create_sqlite_engine(path: Path) -> Engine:
    """An engine with the pragmas below. Tests use it for a throwaway database."""
    engine = create_engine(f"sqlite:///{path}")
    event.listen(engine, "connect", _set_sqlite_pragmas)
    return engine


def _set_sqlite_pragmas(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    # Readers don't block the writer and vice versa: the site keeps serving pages while an
    # admin saves an entry.
    cursor.execute("PRAGMA journal_mode=WAL")
    # Safe in WAL mode (a power loss can lose the last commit, never corrupt the file), and
    # avoids a disk sync on every commit.
    cursor.execute("PRAGMA synchronous=NORMAL")
    # SQLite ignores foreign keys unless this is on, per connection.
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


STORAGE_DIR.mkdir(exist_ok=True)
engine = create_sqlite_engine(DB_PATH)


def get_session() -> Iterator[Session]:
    """One session per request, closed when the request is done (a FastAPI dependency)."""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_session)]
