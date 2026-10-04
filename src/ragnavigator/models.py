import re

from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, validates

HEX_COLOR = re.compile(r"#[0-9a-fA-F]{6}")


class Base(DeclarativeBase):
    pass


class Organization(Base):
    """Whose catalog this is: its name and brand color. A single row."""

    __tablename__ = "organization"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    primary_color: Mapped[str]

    @validates("primary_color")
    def _check_color(self, _key: str, value: str) -> str:
        # The color ends up in the page's CSS. Accepting only "#rrggbb" means a typo fails
        # here, loudly, and nothing else can ever reach the stylesheet.
        if not HEX_COLOR.fullmatch(value):
            raise ValueError(f'primary_color must look like "#1d4f8c", got {value!r}')
        return value


class Category(Base):
    __tablename__ = "category"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)

    # In the order they were entered: the catalog file's order is curated, and sorting by
    # title in SQLite would put accented titles ("Área…") after "Z".
    entries: Mapped[list["Entry"]] = relationship(
        back_populates="category", order_by="Entry.id"
    )


class Entry(Base):
    """One trámite or service: everything a person needs to know to get it done."""

    __tablename__ = "entry"

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("category.id"))
    title: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)
    summary: Mapped[str]
    # Free text on purpose: real values look like "50 Bs", "Gratuito" or "3 a 5 días
    # hábiles". Parse them into numbers only if filtering by them is ever built.
    cost: Mapped[str | None]
    duration: Mapped[str | None]
    notes: Mapped[str | None] = mapped_column(Text)

    category: Mapped[Category] = relationship(back_populates="entries")
    requirements: Mapped[list["Requirement"]] = relationship(
        back_populates="entry",
        order_by="Requirement.position",
        cascade="all, delete-orphan",
    )
    locations: Mapped[list["EntryLocation"]] = relationship(
        back_populates="entry",
        order_by="EntryLocation.position",
        cascade="all, delete-orphan",
    )


class Requirement(Base):
    __tablename__ = "requirement"

    id: Mapped[int] = mapped_column(primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("entry.id", ondelete="CASCADE"))
    name: Mapped[str]
    description: Mapped[str | None]
    # Requirements are shown and indexed as a list, and their order matters to whoever
    # is gathering the documents.
    position: Mapped[int]

    entry: Mapped[Entry] = relationship(back_populates="requirements")


class Location(Base):
    """A place where people go: an office, a counter, a building."""

    __tablename__ = "location"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)
    building: Mapped[str | None]
    floor: Mapped[str | None]
    # How to get there, beyond building and floor ("al fondo del pasillo, ventanilla 3").
    directions: Mapped[str | None] = mapped_column(Text)
    # Free text, like cost and duration: real hours look like "Lunes a viernes 8:00-12:00
    # y 14:00-18:00, sábados 8:00-12:00".
    hours: Mapped[str | None]

    # What's done here, across entries: grouped by entry, each entry's links in step order.
    entries: Mapped[list["EntryLocation"]] = relationship(
        back_populates="location",
        order_by="(EntryLocation.entry_id, EntryLocation.position)",
    )


class EntryLocation(Base):
    """Links an entry to a place, saying what happens there for that entry.

    The same office can be where one trámite is requested and where another is paid, so the
    role belongs to the link, not to the location.
    """

    __tablename__ = "entry_location"

    entry_id: Mapped[int] = mapped_column(
        ForeignKey("entry.id", ondelete="CASCADE"), primary_key=True
    )
    location_id: Mapped[int] = mapped_column(ForeignKey("location.id"), primary_key=True)
    # A noun ("Solicitud", "Pago", "Entrega") so it reads from both sides: under a place on
    # the entry page, and under an entry on the locations page. Part of the key: one place
    # can play two roles for the same entry (request and pick up at the same counter).
    role: Mapped[str] = mapped_column(primary_key=True)
    # The links usually read as steps (request here, pay there, pick up here), so they keep
    # the order they were entered in, like requirements.
    position: Mapped[int]

    entry: Mapped[Entry] = relationship(back_populates="locations")
    location: Mapped[Location] = relationship(back_populates="entries")
