"""Router de autenticação."""
from fastapi import APIRouter, Depends, status

from app.api.deps import get_auth_service
from app.schemas.auth import LoginRequest, TokenResponse
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Cria conta e retorna token de acesso",
)
def register(
    payload: UserCreate,
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    user = service.register(
        name=payload.name,
        email=payload.email,
        password=payload.password,
        initial_skills=[(s.name, s.proficiency) for s in payload.skills],
    )
    return TokenResponse(
        access_token=AuthService.issue_token(user),
        user=UserRead.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Autentica usuário e retorna token de acesso",
)
def login(
    payload: LoginRequest,
    service: AuthService = Depends(get_auth_service),
) -> TokenResponse:
    user = service.authenticate(email=payload.email, password=payload.password)
    return TokenResponse(
        access_token=AuthService.issue_token(user),
        user=UserRead.model_validate(user),
    )
