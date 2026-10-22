"""Answer questions about the catalog with ragstarter, keeping track of where each answer
came from on the site. """

from functools import cache

from llama_index.core import VectorStoreIndex
from llama_index.core.llms import LLM
from ragstarter.core.ingest import load_index
from ragstarter.core.llm import build_llm
from ragstarter.core.query import Answer, answer

from ragnavigator.indexing import INDEX_DIR


def ask(question: str) -> Answer:
    index, llm = _engine()
    # No persona on purpose. ragstarter puts it before its grounding rules, and with
    # llama3.1:8b any persona (Spanish or English) weakened them: the model replied "NO."
    # instead of the NO_ANSWER sentinel, and turned "bolivianos (Bs)" into dollars.
    # Evaluation: 18-19/21 with a persona, 20/21 without, answer language still right.
    return answer(question, index, llm)


def live_index() -> VectorStoreIndex:
    """The index questions are answered from. Edits go into this same object, so answers
    follow them without reloading anything."""
    index, _llm = _engine()
    return index


@cache
def _engine() -> tuple[VectorStoreIndex, LLM]:
    # Loading the index loads the embedding model (bge-m3, ~2 GB), which takes seconds.
    # Done on the first question and kept, rather than at startup, so `fastapi dev`
    # reloads stay fast while working on the rest of the site.
    return load_index(INDEX_DIR), build_llm()
