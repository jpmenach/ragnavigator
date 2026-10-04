from pathlib import Path

from sqlalchemy import create_engine, event

STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"
DB_PATH = STORAGE_DIR / "catalog.db"

STORAGE_DIR.mkdir(exist_ok=True)
engine = create_engine(f"sqlite:///{DB_PATH}")


@event.listens_for(engine, "connect")
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
