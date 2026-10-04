"""Rebuild the catalog database from a JSON file.

Until there's an admin to edit the catalog, the JSON file is the source and the database is
disposable: every run drops all tables and loads the file again.

Run from the repo root with:
    uv run python -m ragnavigator.seed examples/universidad-demo/data/catalog.json
"""

import json
import sys
from pathlib import Path

from sqlalchemy.orm import Session

from ragnavigator.db import DB_PATH, engine
from ragnavigator.models import (
    Base,
    Category,
    Entry,
    EntryLocation,
    Location,
    Organization,
    Requirement,
)


def seed(catalog_path: Path) -> None:
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        session.add(Organization(**catalog["organization"]))

        # Entries refer to locations by slug, so they're created first and looked up here.
        locations = {data["slug"]: Location(**data) for data in catalog["locations"]}
        session.add_all(locations.values())

        for category_data in catalog["categories"]:
            category = Category(name=category_data["name"], slug=category_data["slug"])
            for entry_data in category_data["entries"]:
                category.entries.append(_build_entry(entry_data, locations))
            session.add(category)

        session.commit()

    entry_count = sum(len(c["entries"]) for c in catalog["categories"])
    print(
        f"Seeded {catalog['organization']['name']}: {len(catalog['categories'])} categories, "
        f"{entry_count} entries and {len(locations)} locations into {DB_PATH}"
    )


def _build_entry(data: dict, locations: dict[str, Location]) -> Entry:
    # Positions come from the order in the file, so the JSON reads the way the page will.
    return Entry(
        title=data["title"],
        slug=data["slug"],
        summary=data["summary"],
        cost=data.get("cost"),
        duration=data.get("duration"),
        notes=data.get("notes"),
        requirements=[
            Requirement(name=r["name"], description=r.get("description"), position=i)
            for i, r in enumerate(data["requirements"], start=1)
        ],
        locations=[
            EntryLocation(location=locations[link["location"]], role=link["role"], position=i)
            for i, link in enumerate(data["locations"], start=1)
        ],
    )


if __name__ == "__main__":
    seed(Path(sys.argv[1]))
