"""How Alembic connects: the app's own engine and models, so the database location and its
connection settings (WAL, foreign keys) are defined once, in ragnavigator.db."""

import logging

from alembic import context

from ragnavigator.db import engine
from ragnavigator.models import Base

# Show which migrations run ("Running upgrade ... -> ..."), without an alembic.ini.
logging.basicConfig(format="%(message)s")
logging.getLogger("alembic").setLevel(logging.INFO)

with engine.connect() as connection:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        # SQLite can't alter most of a table in place (drop a column, change a constraint).
        # Batch mode rebuilds the table instead: create a copy, move the rows, swap.
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()
