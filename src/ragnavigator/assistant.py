"""Answer questions about the catalog with ragstarter, keeping track of where each answer
came from on the site."""

from functools import cache

from llama_index.core import VectorStoreIndex
from llama_index.core.llms import LLM
from ragstarter.core.ingest import load_index
from ragstarter.core.llm import build_llm
from ragstarter.core.query import Answer, answer

from ragnavigator.indexing import INDEX_DIR


def ask(question: str, organization_name: str) -> Answer:
    index, llm = _engine()
    return answer(question, index, llm, persona=_persona(organization_name))


@cache
def _engine() -> tuple[VectorStoreIndex, LLM]:
    # Loading the index loads the embedding model (bge-m3, ~2 GB), which takes seconds.
    # Done on the first question and kept, rather than at startup, so `fastapi dev`
    # reloads stay fast while working on the rest of the site.
    return load_index(INDEX_DIR), build_llm()


# In Spanish, like the catalog: with an English persona, llama3.1:8b answered Spanish
# questions in English (2 of 3). ragstarter's language rule still lets English questions
# get English answers.
def _persona(organization_name: str) -> str:
    return (
        f"Eres el asistente virtual de {organization_name}. Ayudas a estudiantes y "
        "visitantes con sus trámites y servicios: requisitos, costos, duración, lugares y "
        "horarios. Responde de forma breve y amable. Copia montos, monedas y horarios tal "
        "como aparecen en el contexto."
    )
