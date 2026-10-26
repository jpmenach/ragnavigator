"""Slugs for URLs, made from names: "Bienestar Universitario" → "bienestar-universitario"."""

import re
import unicodedata


def slugify(text: str) -> str:
    # Accents are dropped, not percent-encoded: "Titulación" → "titulacion", the way the
    # catalog's own slugs are written.
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
