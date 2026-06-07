"""Testes unitários do UserService."""
import pytest

from app.exceptions import AuthError, ConflictError, NotFoundError
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.user_service import UserService


@pytest.fixture
def auth_service(db_session):
    return AuthService(UserRepository(db_session))


@pytest.fixture
def user_service(db_session):
    return UserService(UserRepository(db_session))


@pytest.fixture
def existing_user(auth_service):
    return auth_service.register(name="Ada", email="ada@example.com", password="secret12345")


@pytest.mark.unit
class TestGet:
    def test_returns_user_when_exists(self, user_service, existing_user):
        assert user_service.get(existing_user.id).id == existing_user.id

    def test_raises_when_missing(self, user_service):
        with pytest.raises(NotFoundError):
            user_service.get(99999)


@pytest.mark.unit
class TestUpdateProfile:
    def test_updates_name_and_email(self, user_service, existing_user):
        updated = user_service.update_profile(
            existing_user, name="Ada Lovelace", email="lady@example.com"
        )
        assert updated.name == "Ada Lovelace"
        assert updated.email == "lady@example.com"

    def test_rejects_email_already_in_use(self, auth_service, user_service, existing_user):
        auth_service.register(name="Outra", email="other@example.com", password="otherpass12")
        with pytest.raises(ConflictError):
            user_service.update_profile(existing_user, email="other@example.com")


@pytest.mark.unit
class TestChangePassword:
    def test_changes_password_when_current_is_correct(self, user_service, existing_user):
        user_service.change_password(
            existing_user,
            current_password="secret12345",
            new_password="newpassword99",
        )
        # senha nova autentica, antiga não
        from app.core.security import verify_password

        assert verify_password("newpassword99", existing_user.password_hash)
        assert not verify_password("secret12345", existing_user.password_hash)

    def test_rejects_wrong_current_password(self, user_service, existing_user):
        with pytest.raises(AuthError):
            user_service.change_password(
                existing_user,
                current_password="wrong",
                new_password="newpassword99",
            )

    def test_rejects_when_new_equals_current(self, user_service, existing_user):
        with pytest.raises(ConflictError):
            user_service.change_password(
                existing_user,
                current_password="secret12345",
                new_password="secret12345",
            )


@pytest.mark.unit
class TestDelete:
    def test_delete_removes_user(self, user_service, existing_user):
        user_service.delete(existing_user)
        with pytest.raises(NotFoundError):
            user_service.get(existing_user.id)
