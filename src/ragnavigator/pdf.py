"""The requirements sheet for one entry, as a PDF people can print or carry on their phone.

Uses fpdf2's built-in Helvetica, which covers Spanish (á, ñ, ¿) but only Latin-1: text with
characters like "•" or "—" raises an error. The catalog content avoids them; once an admin can
type anything (Phase 4), bundle a Unicode TTF font instead.
"""

from datetime import date

from fpdf import FPDF
from fpdf.enums import XPos, YPos

from ragnavigator.models import Entry

GRAY = (90, 90, 90)
BLACK = (0, 0, 0)


def requirements_pdf(entry: Entry) -> bytes:
    pdf = FPDF(format="A4")
    pdf.set_margins(20, 20)
    pdf.add_page()

    _text(pdf, entry.category.name, size=10, color=GRAY)
    _text(pdf, entry.title, size=18, style="B")
    _text(pdf, entry.summary, size=11)
    pdf.ln(2)
    if entry.cost:
        _text(pdf, f"Costo: {entry.cost}", size=11)
    if entry.duration:
        _text(pdf, f"Duración: {entry.duration}", size=11)

    _heading(pdf, "Requisitos")
    for number, requirement in enumerate(entry.requirements, start=1):
        _text(pdf, f"{number}. {requirement.name}", size=11)
        if requirement.description:
            _text(pdf, requirement.description, size=10, color=GRAY, indent=5)

    _heading(pdf, "Dónde y cuándo")
    for link in entry.locations:
        location = link.location
        _text(pdf, f"{link.role}: {location.name}", size=11, style="B")
        place = ", ".join(part for part in (location.building, location.floor) if part)
        for detail in (place, location.directions, location.hours):
            if detail:
                _text(pdf, detail, size=10, color=GRAY, indent=5)
        pdf.ln(1)

    if entry.notes:
        _heading(pdf, "Notas")
        _text(pdf, entry.notes, size=11)

    # Requirements change; a printed sheet should say how old it is.
    pdf.ln(6)
    _text(pdf, f"Información vigente al {date.today():%d/%m/%Y}.", size=9, color=GRAY)

    return bytes(pdf.output())


def _heading(pdf: FPDF, text: str) -> None:
    pdf.ln(4)
    _text(pdf, text, size=14, style="B")
    pdf.ln(1)


def _text(
    pdf: FPDF,
    text: str,
    *,
    size: float,
    style: str = "",
    color: tuple[int, int, int] = BLACK,
    indent: float = 0,
) -> None:
    pdf.set_font("helvetica", style=style, size=size)
    pdf.set_text_color(*color)
    pdf.set_x(pdf.l_margin + indent)
    # Width 0 runs to the right margin; the next line starts back at the left margin.
    pdf.multi_cell(0, size * 0.5, text, align="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
