"""Router de trilhas de aprendizado."""
from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_current_user, get_learning_trail_service
from app.models.user import User
from app.schemas.learning_trail import (
    CompleteTicketResponse,
    ConceptExplanation,
    LearningTrailCreate,
    LearningTrailListItem,
    LearningTrailRead,
    ProjectNextQuestionRequest,
    TopicNextQuestionRequest,
    TopicNextQuestionResponse,
    TrailCreationMode,
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
    return [service.to_list_item(trail) for trail in trails]


@router.post(
    "/assessment/next",
    response_model=TopicNextQuestionResponse,
    summary="Próxima pergunta do diagnóstico adaptativo (modo TOPIC)",
)
def next_assessment_question(
    payload: TopicNextQuestionRequest,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> TopicNextQuestionResponse:
    return service.build_next_question_for_user(
        current_user,
        topic=payload.topic,
        previous_answers=payload.previous_answers,
    )


@router.post(
    "/assessment/project/next",
    response_model=TopicNextQuestionResponse,
    summary="Próxima pergunta do diagnóstico adaptativo (modo PROJECT)",
)
def next_project_assessment_question(
    payload: ProjectNextQuestionRequest,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> TopicNextQuestionResponse:
    return service.build_next_project_question_for_user(
        current_user,
        project_scope=payload.project_scope,
        technologies=payload.technologies,
        previous_answers=payload.previous_answers,
    )


@router.post(
    "",
    response_model=LearningTrailRead,
    status_code=status.HTTP_201_CREATED,
    summary="Solicita à IA a geração de uma nova trilha (modo TOPIC ou PROJECT)",
)
def create_trail(
    payload: LearningTrailCreate,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> LearningTrailRead:
    if payload.mode == TrailCreationMode.PROJECT:
        trail = service.create_project_for_user(
            current_user,
            project_scope=payload.project_scope or "",
            technologies=payload.technologies,
            assessment=payload.assessment,
        )
    else:
        trail = service.create_for_user(
            current_user,
            topic=payload.topic or "",
            assessment=payload.assessment,
        )
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
    "/{trail_id}/tickets/{ticket_code}/complete",
    response_model=CompleteTicketResponse,
    summary="Marca um ticket como concluído (auto-conclui a trilha em 100%)",
)
def complete_ticket(
    trail_id: int,
    ticket_code: str,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> CompleteTicketResponse:
    trail, trail_completed, added, upgraded = service.set_ticket_completion(
        current_user, trail_id, ticket_code, completed=True
    )
    return CompleteTicketResponse(
        trail=service.to_read_model(trail),
        trail_completed=trail_completed,
        added_concepts=added,
        upgraded_concepts=upgraded,
    )


@router.delete(
    "/{trail_id}/tickets/{ticket_code}/complete",
    response_model=CompleteTicketResponse,
    summary="Desfaz a conclusão de um ticket (desconclui a trilha se necessário)",
)
def uncomplete_ticket(
    trail_id: int,
    ticket_code: str,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> CompleteTicketResponse:
    trail, _, _, _ = service.set_ticket_completion(
        current_user, trail_id, ticket_code, completed=False
    )
    return CompleteTicketResponse(
        trail=service.to_read_model(trail),
        trail_completed=False,
        added_concepts=[],
        upgraded_concepts=[],
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
    refresh: bool = False,
    current_user: User = Depends(get_current_user),
    service: LearningTrailService = Depends(get_learning_trail_service),
) -> ConceptExplanation:
    return service.explain_concept_for_user(
        current_user,
        trail_id,
        ticket_code,
        concept,
        force_refresh=refresh,
    )
