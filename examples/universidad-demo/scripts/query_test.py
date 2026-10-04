"""Check that the assistant answers what the catalog says, refuses the rest, and that each
answer's top source is the page section the site should open.

Run from the repo root (after seeding and indexing) with:
    uv run python examples/universidad-demo/scripts/query_test.py

Three groups, mixing Spanish and English, as in ragstarter's vet clinic evaluation:
- answerable: the catalog has the answer. It must contain the key facts, and the top
  source must be the right entry and section (that's where Phase 3 will navigate).
- near-miss: about the university, but the catalog doesn't say. Must refuse.
- off-topic: unrelated. Must refuse.

Needs a running Ollama and takes a few minutes. The LLM isn't fully deterministic: run it
more than once before trusting a result.
"""

import re
import time
from dataclasses import dataclass

from ragnavigator.assistant import ask


@dataclass(frozen=True)
class Case:
    question: str
    should_answer: bool
    # Case-insensitive regexes a correct answer must all match, in Spanish or English.
    must_match: tuple[str, ...] = ()
    # Routes accepted as the top source. Some questions have more than one right place
    # (a location's hours are on its own card and in every entry that uses it).
    sources: tuple[str, ...] = ()


E = "/entries/"

ANSWERABLE = [
    Case("¿Qué necesito para el certificado de notas?", True,
         (r"carnet|\bCI\b|identi", r"formulario|form"),
         (f"{E}certificado-de-notas#requirements",)),
    Case("¿Qué documentos piden para el certificado de alumno regular?", True,
         (r"inscripci|enrol",),
         (f"{E}certificado-de-alumno-regular#requirements",)),
    Case("¿Dónde pago el certificado de notas?", True,
         (r"caja",),
         (f"{E}certificado-de-notas#where-and-when", f"{E}certificado-de-notas#requirements")),
    Case("¿Cuánto cuesta el diploma académico?", True,
         (r"\b800\b", r"bolivian|\bBs\b"),
         (f"{E}solicitud-de-diploma-academico",)),
    Case("How much does each legalized copy of my diploma cost?", True,
         (r"\b40\b", r"bolivian|\bBs\b"),
         (f"{E}legalizacion-de-diploma",)),
    Case("¿Hasta cuándo puedo retirar una materia?", True,
         (r"\b6\b|seis|six",),
         (f"{E}retiro-de-materias#notes",)),
    Case("¿En cuántas cuotas puedo pagar la colegiatura?", True,
         (r"\b5\b|cinco|five",),
         (f"{E}plan-de-pagos#notes", f"{E}plan-de-pagos")),
    Case("¿Qué promedio necesito para la beca?", True,
         (r"\b65\b",),
         (f"{E}beca-socioeconomica#requirements",)),
    Case("¿Cuánto tarda el cambio de carrera?", True,
         (r"\b10\b|diez|ten",),
         (f"{E}cambio-de-carrera",)),
    Case("¿A qué hora atiende la secretaría general?", True,
         (r"9:00", r"12:00"),
         ("/locations#secretaria-general",
          f"{E}solicitud-de-diploma-academico#where-and-when",
          f"{E}legalizacion-de-diploma#where-and-when")),
    Case("Can someone else pick up my diploma for me?", True,
         (r"poder|power of attorney|notar",),
         (f"{E}solicitud-de-diploma-academico#notes",)),
    # Known failure: often a bare "NO", though the catalog says first aid yes, serious
    # emergencies go to the hospital. A yes/no misreading, like ragstarter's "festivos".
    Case("¿El gabinete médico atiende emergencias?", True,
         (r"hospital|deriv|refer",),
         (f"{E}atencion-en-gabinete-medico#notes",)),
]

NEAR_MISS = [
    Case(q, False) for q in [
        "¿Dan becas deportivas?",
        "¿Cuánto cuesta la matrícula del primer semestre?",
        "Is there a student dormitory?",
        "¿Tienen estacionamiento para bicicletas?",
        "¿Cuándo empiezan las clases?",
        # On a real entry, but the catalog never mentions doing it online.
        "¿Puedo pedir el certificado de notas por internet?",
    ]
]

OFF_TOPIC = [
    Case(q, False) for q in [
        "What's the capital of France?",
        "¿Cómo preparo una lasaña?",
        "Who won the 2022 World Cup?",
    ]
]

GROUPS = {"answerable": ANSWERABLE, "near-miss": NEAR_MISS, "off-topic": OFF_TOPIC}


def check(case: Case, grounded: bool, text: str, top_route: str | None) -> str | None:
    """Return why the case failed, or None if it passed."""
    if grounded != case.should_answer:
        return "answered" if grounded else "refused"
    missing = [p for p in case.must_match if not re.search(p, text, re.IGNORECASE)]
    if missing:
        return f"answer doesn't match {', '.join(missing)}"
    if case.sources and top_route not in case.sources:
        return f"top source was {top_route}"
    return None


def main() -> None:
    failures = []
    top_scores: dict[str, list[float]] = {group: [] for group in GROUPS}

    for group, cases in GROUPS.items():
        for case in cases:
            start = time.perf_counter()
            result = ask(case.question)
            elapsed = time.perf_counter() - start

            top = max(result.sources, key=lambda chunk: chunk.score, default=None)
            top_route = top.metadata["route"] if top else None
            top_scores[group].append(top.score if top else 0.0)

            problem = check(case, result.grounded, result.text, top_route)
            if problem:
                failures.append((case.question, problem))
            print(f"\n[{'FAIL' if problem else 'PASS'}] {case.question}")
            print(f"  expected: {'answer' if case.should_answer else 'refuse'}"
                  f"  |  top: {top.score if top else 0:.3f} {top_route}  |  {elapsed:.1f}s")
            print(f"  {result.text if result.grounded else '-> refused'}")
            if problem:
                print(f"  why: {problem}")

    total = sum(len(cases) for cases in GROUPS.values())
    print(f"\n{total - len(failures)}/{total} passed")
    for question, problem in failures:
        print(f"  FAIL  {question}  ({problem})")

    # For choosing min_score: answerable questions should score clearly above the others.
    print("\nTop-1 similarity by group (min / max):")
    for group, scores in top_scores.items():
        print(f"  {group:11} {min(scores):.3f} / {max(scores):.3f}")


if __name__ == "__main__":
    main()
