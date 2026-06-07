"""Router de skills (tecnologias/conceitos do aluno)."""
from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_current_user, get_skill_service
from app.models.user import User
from app.schemas.skill import SkillCreate, SkillRead, SkillUpdate
from app.services.skill_service import SkillService

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("", response_model=list[SkillRead], summary="Lista as skills do usuário")
def list_skills(
    current_user: User = Depends(get_current_user),
    service: SkillService = Depends(get_skill_service),
) -> list[SkillRead]:
    skills = service.list_for_user(current_user)
    return [SkillRead.from_model(s) for s in skills]


@router.post(
    "",
    response_model=SkillRead,
    status_code=status.HTTP_201_CREATED,
    summary="Adiciona uma skill ao perfil",
)
def add_skill(
    payload: SkillCreate,
    current_user: User = Depends(get_current_user),
    service: SkillService = Depends(get_skill_service),
) -> SkillRead:
    skill = service.add_for_user(
        current_user, name=payload.name, proficiency=payload.proficiency
    )
    return SkillRead.from_model(skill)


@router.patch(
    "/{skill_id}",
    response_model=SkillRead,
    summary="Atualiza a proficiência de uma skill",
)
def update_skill(
    skill_id: int,
    payload: SkillUpdate,
    current_user: User = Depends(get_current_user),
    service: SkillService = Depends(get_skill_service),
) -> SkillRead:
    skill = service.update_for_user(
        current_user, skill_id, proficiency=payload.proficiency
    )
    return SkillRead.from_model(skill)


@router.delete(
    "/{skill_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove uma skill do perfil",
)
def delete_skill(
    skill_id: int,
    current_user: User = Depends(get_current_user),
    service: SkillService = Depends(get_skill_service),
) -> Response:
    service.delete_for_user(current_user, skill_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
