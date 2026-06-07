"""Service de autenticação."""
from typing import Iterable

from app.core.security import create_access_token, hash_password, verify_password
from app.exceptions import AuthError, ConflictError
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.skill_service import SkillService


class AuthService:
    def __init__(
        self,
        user_repository: UserRepository,
        skill_service: SkillService | None = None,
    ) -> None:
        self.user_repository = user_repository
        self.skill_service = skill_service

    def register(
        self,
        *,
        name: str,
        email: str,
        password: str,
        initial_skills: Iterable[tuple[str, int]] = (),
    ) -> User:
        if self.user_repository.get_by_email(email):
            raise ConflictError("Já existe uma conta com este email")
        user = self.user_repository.create(
            name=name,
            email=email,
            password_hash=hash_password(password),
        )
        if self.skill_service is not None:
            for skill_name, level in initial_skills:
                self.skill_service.add_for_user(
                    user, name=skill_name, proficiency=level
                )
        return user

    def authenticate(self, *, email: str, password: str) -> User:
        user = self.user_repository.get_by_email(email)
        if user is None or not verify_password(password, user.password_hash):
            raise AuthError("Credenciais inválidas")
        return user

    @staticmethod
    def issue_token(user: User) -> str:
        return create_access_token(subject=user.id)
