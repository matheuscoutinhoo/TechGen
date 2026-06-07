"""Service de usuário — gerência de conta após autenticação."""
from app.core.security import hash_password, verify_password
from app.exceptions import AuthError, ConflictError, NotFoundError
from app.models.user import User
from app.repositories.user_repository import UserRepository


class UserService:
    def __init__(self, user_repository: UserRepository) -> None:
        self.user_repository = user_repository

    def get(self, user_id: int) -> User:
        user = self.user_repository.get(user_id)
        if user is None:
            raise NotFoundError("Usuário não encontrado")
        return user

    def update_profile(
        self,
        user: User,
        *,
        name: str | None = None,
        email: str | None = None,
    ) -> User:
        if email and email.lower() != user.email:
            if self.user_repository.get_by_email(email):
                raise ConflictError("Já existe uma conta com este email")
            user.email = email.lower()
        if name:
            user.name = name
        return self.user_repository.update(user)

    def change_password(
        self,
        user: User,
        *,
        current_password: str,
        new_password: str,
    ) -> User:
        if not verify_password(current_password, user.password_hash):
            raise AuthError("Senha atual incorreta")
        if current_password == new_password:
            raise ConflictError("A nova senha deve ser diferente da atual")
        user.password_hash = hash_password(new_password)
        return self.user_repository.update(user)

    def delete(self, user: User) -> None:
        self.user_repository.delete(user)
