"""What the API returns. Kept apart from the models so the database can change without
changing the shape the frontend relies on."""

from pydantic import BaseModel, ConfigDict


class Schema(BaseModel):
    # Lets every schema be built straight from a SQLAlchemy object.
    model_config = ConfigDict(from_attributes=True)


class CategoryOut(Schema):
    name: str
    slug: str


class RequirementOut(Schema):
    name: str
    description: str | None


class LocationOut(Schema):
    name: str
    slug: str
    building: str | None
    floor: str | None
    directions: str | None
    hours: str | None


class EntryLocationOut(Schema):
    role: str
    location: LocationOut


class EntryOut(Schema):
    title: str
    slug: str
    summary: str
    cost: str | None
    duration: str | None
    notes: str | None
    category: CategoryOut
    requirements: list[RequirementOut]
    locations: list[EntryLocationOut]
