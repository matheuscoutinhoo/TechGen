"""Testes unitários do LearningTrailService."""
import pytest

from app.exceptions import ForbiddenError, NotFoundError
from app.repositories.learning_trail_repository import LearningTrailRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.ai.fake_provider import FakeAIProvider
from app.services.learning_trail_service import LearningTrailService


@pytest.fixture
def service(db_session, fake_ai_provider):
    return LearningTrailService(
        repository=LearningTrailRepository(db_session),
        ai_provider=fake_ai_provider,
    )


@pytest.fixture
def user_a(db_session):
    auth = AuthService(UserRepository(db_session))
    return auth.register(name="Ada", email="ada@example.com", password="secret12345")


@pytest.fixture
def user_b(db_session):
    auth = AuthService(UserRepository(db_session))
    return auth.register(name="Linus", email="linus@example.com", password="secret12345")


@pytest.mark.unit
class TestCreate:
    def test_creates_trail_using_ai_provider(self, service, user_a):
        trail = service.create_for_user(user_a, topic="FastAPI")
        assert trail.id is not None
        assert trail.user_id == user_a.id
        assert trail.topic == "FastAPI"
        assert trail.title

    def test_persists_content_as_valid_json(self, service, user_a):
        trail = service.create_for_user(user_a, topic="FastAPI")
        read = service.to_read_model(trail)
        assert read.content.project_title == trail.title
        assert len(read.content.tickets) >= 6


@pytest.mark.unit
class TestAccessControl:
    def test_user_cannot_access_anothers_trail(self, service, user_a, user_b):
        trail = service.create_for_user(user_a, topic="Rust")
        with pytest.raises(ForbiddenError):
            service.get_for_user(user_b, trail.id)

    def test_get_missing_trail_raises_not_found(self, service, user_a):
        with pytest.raises(NotFoundError):
            service.get_for_user(user_a, 99999)


@pytest.mark.unit
class TestUpdate:
    def test_partial_update_changes_only_provided_fields(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Go")
        old_summary = trail.summary
        updated = service.update_for_user(user_a, trail.id, title="Novo título")
        assert updated.title == "Novo título"
        assert updated.summary == old_summary

    def test_update_with_content_overwrites_and_syncs_title_summary(self, service, user_a):
        from app.schemas.learning_trail import Ticket, TicketTask, TrailContent

        trail = service.create_for_user(user_a, topic="Java")
        new_content = TrailContent(
            project_title="Projeto refeito",
            project_summary="Resumo refeito do projeto.",
            why_realistic="Porque o aluno editou manualmente.",
            target_audience="Devs experientes.",
            prerequisites=["Git"],
            tickets=[
                Ticket(
                    code="TG-1",
                    title="Novo ticket",
                    objective="Objetivo claro do ticket editado.",
                    concepts=["edição"],
                    tasks=[TicketTask(description="Tarefa única")],
                    acceptance_criteria=["Critério único"],
                )
            ],
        )
        updated = service.update_for_user(user_a, trail.id, content=new_content)
        assert updated.title == "Projeto refeito"
        assert updated.summary == "Resumo refeito do projeto."
        read = service.to_read_model(updated)
        assert read.content.tickets[0].title == "Novo ticket"


@pytest.mark.unit
class TestToReadModel:
    def test_raises_when_content_json_is_corrupted(self, service, user_a):
        from app.exceptions import ValidationError as DomainValidationError

        trail = service.create_for_user(user_a, topic="Elixir")
        trail.content_json = "{not valid json"
        with pytest.raises(DomainValidationError):
            service.to_read_model(trail)


@pytest.mark.unit
class TestRegenerate:
    def test_regenerate_replaces_content_keeping_topic(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Kubernetes")
        original_id = trail.id
        regenerated = service.regenerate_for_user(user_a, trail.id)
        assert regenerated.id == original_id
        assert regenerated.topic == "Kubernetes"


@pytest.mark.unit
class TestDelete:
    def test_delete_removes_trail(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Docker")
        service.delete_for_user(user_a, trail.id)
        with pytest.raises(NotFoundError):
            service.get_for_user(user_a, trail.id)

    def test_delete_blocked_for_other_user(self, service, user_a, user_b):
        trail = service.create_for_user(user_a, topic="Docker")
        with pytest.raises(ForbiddenError):
            service.delete_for_user(user_b, trail.id)
