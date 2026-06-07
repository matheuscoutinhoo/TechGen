"""Router de trilhas de aprendizado."""
from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_current_user, get_learning_trail_service
from app.models.user import User
from app.schemas.learning_trail import (
    CompleteTrailResponse,
    ConceptExplanation,
    LearningTrailCreate,
    LearningTrailListItem,
    LearningTrailRead,
    LearningTrailUpdate,
)
from app.services.learning_trail_service import LearningTrailService

router = APIRouter(prefix="/learning-trails", tags=["learning-trails"])


@router.get(
    "",
    response_model=list[LearningTrailListItem],
    summary="Lista as trilhas do usuário autenticado",
)
def list_trails(
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> list[LearningTrailListItem]:
    trails = service.list_for_user(current_user)
    return [LearningTrailListItem.model_validate(trail) for trail in trails]


@router.post(
    "",
    response_model=LearningTrailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Solicita à IA a geração de uma nova trilha",
)
def create_trail(
    payload: LearningTrailCreate,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> LearningTrailRead:
    trail = service.create_for_user(current_user, topic=payload.topic)
    return service.to_read_model(trail)


@router.get(
    "/{trail_id}",
    response_model=LearningTrailRead,
    summary="Obtém uma trilha específica do usuário",
)
def get_trail(
    trail_id: int,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> LearningTrailRead:
    trail = service.get_for_user(current_user, trail_id)
    return service.to_read_model(trail)


@router.patch(
    "/{trail_id}",
    response_model=LearningTrailRead,
    summary="Edita manualmente uma trilha",
)
def update_trail(
    trail_id: int,
    payload: LearningTrailUpdate,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> LearningTrailRead:
    trail = service.update_for_user(
        current_user,
        trail_id,
        title=payload.title,
        summary=payload.summary,
        content=payload.content,
    )
    return service.to_read_model(trail)


@router.post(
    "/{trail_id}/regenerate",
    response_model=LearningTrailRead,
    summary="Regenera a trilha mantendo o tema original",
)
def regenerate_trail(
    trail_id: int,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> LearningTrailRead:
    trail = service.regenerate_for_user(current_user, trail_id)
    return service.to_read_model(trail)


@router.delete(
    "/{trail_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Exclui uma trilha do usuário",
)
def delete_trail(
    trail_id: int,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> Response:
    service.delete_for_user(current_user, trail_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{trail_id}/complete",
    response_model=CompleteTrailResponse,
    summary="Marca a trilha como concluída e atualiza as skills do usuário",
)
def complete_trail(
    trail_id: int,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> CompleteTrailResponse:
    trail, added, upgraded = service.complete_for_user(current_user, trail_id)
    return CompleteTrailResponse(
        trail=service.to_read_model(trail),
        added_concepts=added,
        upgraded_concepts=upgraded,
    )


@router.get(
    "/{trail_id}/tickets/{ticket_code}/concepts/{concept}",
    response_model=ConceptExplanation,
    summary="Explica em profundidade um conceito de um ticket via IA",
)
def explain_concept(
    trail_id: int,
    ticket_code: str,
    concept: str,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> ConceptExplanation:
    return service.explain_concept_for_user(
        current_user, trail_id, ticket_code, concept
    )
