import io

from pypdf import PdfReader

from ragnavigator.models import Category, Entry, Requirement
from ragnavigator.pdf import requirements_pdf


def pdf_text(entry: Entry) -> str:
    return PdfReader(io.BytesIO(requirements_pdf(entry))).pages[0].extract_text()


def test_text_outside_latin_1_is_drawn():
    # What an admin may type: curly quotes, dashes, bullets, the euro sign. With the
    # built-in Helvetica (Latin-1 only), any of these made the PDF fail.
    entry = Entry(
        title="Certificado “oficial”",
        slug="certificado",
        summary="Trámite — rápido • 50 €",
        category=Category(name="Académico", slug="academico"),
        requirements=[Requirement(name="Carnet «vigente»", description="Sí… ¿y?", position=0)],
        locations=[],
    )

    text = pdf_text(entry)

    typed = [
        "Certificado “oficial”",
        "Trámite — rápido • 50 €",
        "Carnet «vigente»",
        "Sí… ¿y?",
    ]
    for snippet in typed:
        assert snippet in text


def test_a_character_the_font_lacks_is_skipped_not_an_error():
    # DejaVu has no emoji: fpdf2 leaves it out (with a warning) and the sheet still renders.
    entry = Entry(
        title="Certificado 📄",
        slug="certificado",
        summary="Tus notas.",
        category=Category(name="Académico", slug="academico"),
        requirements=[],
        locations=[],
    )

    assert "Certificado" in pdf_text(entry)
