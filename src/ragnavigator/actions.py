"""Decide what the site should do after an answer. Code decides, not the LLM: the model
only answers, and the actions come from the metadata of the source it answered from, so
every route is one the site actually has."""

from ragnavigator.schemas import (
    Action,
    HighlightAction,
    NavigateAction,
    OfferDownloadAction,
    SourceOut,
)


def actions_for(sources: list[SourceOut]) -> list[Action]:
    if not sources:
        return []
    # The top source only: in the evaluation it was the right entry and section in 12/12
    # cases, while lower-ranked sources are often a neighboring entry.
    top = max(sources, key=lambda source: source.score)

    actions: list[Action] = [NavigateAction(to=top.route)]
    _, _, anchor = top.route.partition("#")
    if anchor:
        actions.append(HighlightAction(target=anchor))
    if top.kind == "entry":
        actions.append(
            OfferDownloadAction(
                url=f"/api/entries/{top.slug}/requirements.pdf",
                label="Descargar requisitos (PDF)",
            )
        )
    return actions
