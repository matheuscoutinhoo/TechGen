"""Testes unitários do AuthService."""
import pytest

from app.exceptions import AuthError, ConflictError
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService


@pytest.fixture
def service(db_session):
    return AuthService(UserRepository(db_session))


@pytest.mark.unit
class TestRegister:
    def test_register_creates_user_with_hashed_password(self, service):
        user = service.register(name="Ada", email="ADA@example.com", password="secret12345")
        assert user.id is not None
        assert user.email == "ada@example.com"  # normalizado
        assert user.password_hash != "secret12345"

    def test_register_rejects_duplicate_email(self, service):
        service.register(name="Ada", email="ada@example.com", password="secret12345")
        with pytest.raises(ConflictError):
            service.register(name="Outra", email="ada@example.com", password="otherpass")


@pytest.mark.unit
class TestAuthenticate:
    def test_authenticate_returns_user_when_credentials_match(self, service):
        service.register(name="Ada", email="ada@example.com", password="secret12345")
        user = service.authenticate(email="ada@example.com", password="secret12345")
        assert user.email == "ada@example.com"

    def test_authenticate_raises_for_unknown_email(self, service):
        with pytest.raises(AuthError):
            service.authenticate(email="ghost@example.com", password="whatever123")

    def test_authenticate_raises_for_wrong_password(self, service):
        service.register(name="Ada", email="ada@example.com", password="secret12345")
        with pytest.raises(AuthError):
            service.authenticate(email="ada@example.com", password="wrongpass1234")


@pytest.mark.unit
class TestIssueToken:
    def test_issue_token_returns_decodable_token(self, service):
        user = service.register(name="Ada", email="ada@example.com", password="secret12345")
        token = AuthService.issue_token(user)
        from app.core.security import decode_access_token

        assert decode_access_token(token) == str(user.id)
