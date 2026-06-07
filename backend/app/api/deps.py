"""Dependências comuns dos routers FastAPI."""
from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.repositories.learning_trail_repository import LearningTrailRepository
from app.repositories.user_repository import UserRepository
from app.services.ai.base import AIProvider
from app.services.ai.factory import get_ai_provider
from app.services.auth_service import AuthService
from app.services.learning_trail_service import LearningTrailService
from app.services.user_service import UserService


# -------- Repositories --------
def get_user_repository(db: Session = Depends(get_db)) -> UserRepository:
    return UserRepository(db)


def get_learning_trail_repository(db: Session = Depends(get_db)) -> LearningTrailRepository:
    return LearningTrailRepository(db)


# -------- Services --------
def get_auth_service(
    repo: UserRepository = Depends(get_user_repository),
) -> AuthService:
    return AuthService(repo)


def get_user_service(
    repo: UserRepository = Depends(get_user_repository),
) -> UserService:
    return UserService(repo)


def get_ai_provider_dep() -> AIProvider:
    return get_ai_provider()


def get_learning_trail_service(
    repo: LearningTrailRepository = Depends(get_learning_trail_repository),
    ai: AIProvider = Depends(get_ai_provider_dep),
) -> LearningTrailService:
    return LearningTrailService(repository=repo, ai_provider=ai)


# -------- Autenticação --------
def get_current_user(
    authorization: str | None = Header(default=None),
    user_repo: UserRepository = Depends(get_user_repository),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token ausente ou inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1].strip()
    subject = decode_access_token(token)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        user_id = int(subject)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
        ) from exc
    user = user_repo.get(user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário do token não existe mais",
        )
    return user
