from sqlalchemy import ForeignKey, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Category(Base):
    __tablename__ = "category"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)

    entries: Mapped[list["Entry"]] = relationship(back_populates="category")


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
