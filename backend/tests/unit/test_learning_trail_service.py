"""Testes unitários do LearningTrailService."""
import pytest

from app.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.repositories.learning_trail_repository import LearningTrailRepository
from app.repositories.skill_repository import SkillRepository
from app.repositories.user_repository import UserRepository
from app.services.auth_service import AuthService
from app.services.ai.fake_provider import FakeAIProvider  # noqa: F401
from app.services.learning_trail_service import LearningTrailService
from app.services.skill_service import SkillService


@pytest.fixture
def skill_service(db_session):
    return SkillService(SkillRepository(db_session))


@pytest.fixture
def service(db_session, fake_ai_provider, skill_service):
    return LearningTrailService(
        repository=LearningTrailRepository(db_session),
        ai_provider=fake_ai_provider,
        skill_service=skill_service,
    )


@pytest.fixture
def user_a(db_session, skill_service):
    auth = AuthService(UserRepository(db_session), skill_service=skill_service)
    return auth.register(name="Ada", email="ada@example.com", password="secret12345")


@pytest.fixture
def user_b(db_session, skill_service):
    auth = AuthService(UserRepository(db_session), skill_service=skill_service)
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


@pytest.mark.unit
class TestComplete:
    def test_complete_marks_trail_and_adds_concepts_as_skills(
        self, service, user_a, skill_service
    ):
        trail = service.create_for_user(user_a, topic="FastAPI")
        # antes: usuário não tem skills
        assert list(skill_service.list_for_user(user_a)) == []

        completed, added, upgraded = service.complete_for_user(user_a, trail.id)

        assert completed.completed_at is not None
        assert added  # novos conceitos viraram skills
        # cada skill criada existe no repositório
        skills = {s.name for s in skill_service.list_for_user(user_a)}
        assert all(name in skills for name in added)

    def test_complete_upgrades_existing_skill_below_target(
        self, service, user_a, skill_service
    ):
        # cria uma skill em nível novice; conclusão deve elevar para beginner (2)
        skill_service.add_for_user(user_a, name="TDD", proficiency=1)

        trail = service.create_for_user(user_a, topic="Ruby")
        _, _, upgraded = service.complete_for_user(user_a, trail.id)

        assert "tdd" in upgraded
        skill = next(s for s in skill_service.list_for_user(user_a) if s.name == "tdd")
        assert skill.proficiency == 2

    def test_complete_twice_raises_conflict(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Crystal")
        service.complete_for_user(user_a, trail.id)
        with pytest.raises(ConflictError):
            service.complete_for_user(user_a, trail.id)


@pytest.mark.unit
class TestExplainConcept:
    def test_returns_explanation_for_valid_concept(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Haskell")
        ticket = service.to_read_model(trail).content.tickets[0]
        explanation = service.explain_concept_for_user(
            user_a, trail.id, ticket.code, ticket.concepts[0]
        )
        assert explanation.concept == ticket.concepts[0]
        assert explanation.definition
        assert explanation.examples

    def test_raises_when_ticket_does_not_exist(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Haskell")
        with pytest.raises(NotFoundError):
            service.explain_concept_for_user(user_a, trail.id, "TG-999", "qualquer")

    def test_raises_when_concept_not_in_ticket(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Haskell")
        ticket = service.to_read_model(trail).content.tickets[0]
        with pytest.raises(NotFoundError):
            service.explain_concept_for_user(
                user_a, trail.id, ticket.code, "ConceitoFantasma"
            )
