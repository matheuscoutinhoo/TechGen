"""Router de gerenciamento de conta."""
from fastapi import APIRouter, Depends, Response, status

from app.api.deps import get_current_user, get_user_service
from app.models.user import User
from app.schemas.user import PasswordChange, UserRead, UserUpdate
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead, summary="Dados do usuário autenticado")
def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead, summary="Atualiza nome/email")
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> UserRead:
    updated = service.update_profile(
        current_user,
        name=payload.name,
        email=payload.email,
    )
    return UserRead.model_validate(updated)


@router.post(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Altera senha do usuário autenticado",
)
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> Response:
    service.change_password(
        current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Exclui a conta do usuário autenticado",
)
def delete_me(
    current_user: User = Depends(get_current_user),
    service: UserService = Depends(get_user_service),
) -> Response:
    service.delete(current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
