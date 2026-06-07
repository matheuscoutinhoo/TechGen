"""Testes unitários do SkillService."""
import pytest

from app.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.repositories.skill_repository import SkillRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.skill_service import SkillService


@pytest.fixture
def skill_service(db_session):
    return SkillService(SkillRepository(db_session))


@pytest.fixture
def user(db_session, skill_service):
    auth = AuthService(UserRepository(db_session), skill_service=skill_service)
    return auth.register(name="Ada", email="ada@example.com", password="secret12345")


@pytest.mark.unit
class TestAdd:
    def test_adds_skill_with_default_level(self, skill_service, user):
        skill = skill_service.add_for_user(user, name="FastAPI", proficiency=2)
        assert skill.name == "fastapi"  # normalizado
        assert skill.proficiency == 2

    def test_rejects_duplicate_name(self, skill_service, user):
        skill_service.add_for_user(user, name="TDD", proficiency=2)
        with pytest.raises(ConflictError):
            skill_service.add_for_user(user, name="TDD", proficiency=3)

    def test_rejects_invalid_proficiency(self, skill_service, user):
        with pytest.raises(ConflictError):
            skill_service.add_for_user(user, name="Foo", proficiency=9)

    def test_rejects_empty_name(self, skill_service, user):
        with pytest.raises(ConflictError):
            skill_service.add_for_user(user, name="   ", proficiency=2)


@pytest.mark.unit
class TestUpdate:
    def test_updates_proficiency(self, skill_service, user):
        skill = skill_service.add_for_user(user, name="Go", proficiency=1)
        updated = skill_service.update_for_user(user, skill.id, proficiency=3)
        assert updated.proficiency == 3

    def test_raises_when_skill_belongs_to_another_user(
        self, db_session, skill_service, user
    ):
        skill = skill_service.add_for_user(user, name="Rust", proficiency=2)
        other = AuthService(
            UserRepository(db_session), skill_service=skill_service
        ).register(name="X", email="x@example.com", password="anotherpass")
        with pytest.raises(ForbiddenError):
            skill_service.update_for_user(other, skill.id, proficiency=3)

    def test_raises_when_not_found(self, skill_service, user):
        with pytest.raises(NotFoundError):
            skill_service.update_for_user(user, 99999, proficiency=2)


@pytest.mark.unit
class TestDelete:
    def test_delete_removes_skill(self, skill_service, user):
        skill = skill_service.add_for_user(user, name="React", proficiency=2)
        skill_service.delete_for_user(user, skill.id)
        assert list(skill_service.list_for_user(user)) == []


@pytest.mark.unit
class TestApplyConcepts:
    def test_creates_new_skills_for_unknown_concepts(self, skill_service, user):
        added, upgraded = skill_service.apply_concepts(
            user, ["JWT", "Repository"], target_level=2
        )
        assert sorted(added) == ["jwt", "repository"]
        assert upgraded == []

    def test_upgrades_existing_skill_below_target(self, skill_service, user):
        skill_service.add_for_user(user, name="JWT", proficiency=1)
        added, upgraded = skill_service.apply_concepts(
            user, ["JWT"], target_level=3
        )
        assert added == []
        assert upgraded == ["jwt"]
        skill = next(s for s in skill_service.list_for_user(user) if s.name == "jwt")
        assert skill.proficiency == 3

    def test_keeps_skill_when_already_at_or_above_target(self, skill_service, user):
        skill_service.add_for_user(user, name="JWT", proficiency=3)
        added, upgraded = skill_service.apply_concepts(
            user, ["JWT"], target_level=2
        )
        assert added == []
        assert upgraded == []

    def test_ignores_empty_and_deduplicates(self, skill_service, user):
        added, _ = skill_service.apply_concepts(
            user, ["TDD", "tdd", " ", "", "TDD"], target_level=2
        )
        assert added == ["tdd"]