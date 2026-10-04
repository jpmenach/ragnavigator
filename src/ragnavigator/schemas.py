"""What the API takes and returns. Kept apart from the models so the database can change without
changing the shape the frontend relies on. """

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field


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


class EntrySummaryOut(Schema):
    title: str
    slug: str
    summary: str


class CategoryWithEntriesOut(CategoryOut):
    entries: list[EntrySummaryOut]


class LocationEntryOut(Schema):
    role: str
    entry: EntrySummaryOut


class LocationWithEntriesOut(LocationOut):
    entries: list[LocationEntryOut]


class OrganizationOut(Schema):
    name: str
    primary_color: str


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class SourceOut(BaseModel):
    kind: str
    slug: str
    section: str
    route: str
    score: float


class NavigateAction(BaseModel):
    type: Literal["navigate"] = "navigate"
    # A site route, with the section's #anchor when there is one.
    to: str


class HighlightAction(BaseModel):
    type: Literal["highlight"] = "highlight"
    # The id of an element on the page the user was just taken to.
    target: str


class OfferDownloadAction(BaseModel):
    type: Literal["offer_download"] = "offer_download"
    url: str
    label: str


# The closed set of things the assistant can make the site do. All of them only show
# things; none changes data, so the frontend can run them without asking.
Action = Annotated[
    NavigateAction | HighlightAction | OfferDownloadAction, Field(discriminator="type")
]


class AskOut(BaseModel):
    # Empty when not grounded: the catalog doesn't answer the question, and the frontend
    # says so in its own words instead of showing a guess.
    answer: str
    grounded: bool
    sources: list[SourceOut]
    actions: list[Action]
