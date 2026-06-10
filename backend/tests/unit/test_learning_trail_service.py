"""Testes unitários do LearningTrailService."""
import pytest

from app.exceptions import ForbiddenError, NotFoundError
from app.repositories.concept_explanation_repository import (
    ConceptExplanationRepository,
)
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
def concept_cache_repo(db_session):
    return ConceptExplanationRepository(db_session)


@pytest.fixture
def service(db_session, fake_ai_provider, skill_service, concept_cache_repo):
    return LearningTrailService(
        repository=LearningTrailRepository(db_session),
        ai_provider=fake_ai_provider,
        skill_service=skill_service,
        concept_cache_repository=concept_cache_repo,
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

    def test_regenerate_reuses_stored_assessment(self, service, user_a):
        from app.schemas.learning_trail import TopicAnswer

        answers = [
            TopicAnswer(
                question_id="q1",
                question="Você já usou FastAPI?",
                answer="Nunca usei FastAPI",
            )
        ]
        trail = service.create_for_user(
            user_a, topic="API design com FastAPI", assessment=answers
        )
        # primeiro create já deixou marca da resposta no personalization
        original_notes = " ".join(
            t.personalization_notes or ""
            for t in service.to_read_model(trail).content.tickets
        )
        assert "Nunca usei FastAPI" in original_notes

        regenerated = service.regenerate_for_user(user_a, trail.id)
        regenerated_notes = " ".join(
            t.personalization_notes or ""
            for t in service.to_read_model(regenerated).content.tickets
        )
        # regenerate deve reaproveitar o assessment armazenado
        assert "Nunca usei FastAPI" in regenerated_notes


@pytest.mark.unit
class TestAssessment:
    def test_build_next_question_returns_first_for_empty_history(self, service, user_a):
        result = service.build_next_question_for_user(user_a, topic="FastAPI")
        assert result.done is False
        assert result.question is not None
        assert result.question.id == "q1"

    def test_build_next_question_adapts_to_previous_answer(self, service, user_a):
        from app.schemas.learning_trail import TopicAnswer

        low = service.build_next_question_for_user(
            user_a,
            topic="FastAPI",
            previous_answers=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )
        high = service.build_next_question_for_user(
            user_a,
            topic="FastAPI",
            previous_answers=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Uso FastAPI no dia a dia",
                )
            ],
        )
        assert low.question is not None and high.question is not None
        assert low.question.question != high.question.question

    def test_build_next_question_returns_done_when_history_full(self, service, user_a):
        from app.schemas.learning_trail import TopicAnswer

        answers = [
            TopicAnswer(question_id=f"q{i}", question=f"P{i}?", answer=f"R{i}")
            for i in range(1, 6)
        ]
        result = service.build_next_question_for_user(
            user_a, topic="FastAPI", previous_answers=answers
        )
        assert result.done is True
        assert result.question is None

    def test_assessment_changes_generated_trail(self, service, user_a):
        """Garante que o assessment realmente afeta a trilha gerada — não decorativo."""
        from app.schemas.learning_trail import TopicAnswer

        topic = "API design com FastAPI"
        without = service.create_for_user(user_a, topic=topic)
        with_assessment = service.create_for_user(
            user_a,
            topic=topic,
            assessment=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )

        without_content = service.to_read_model(without).content
        with_content = service.to_read_model(with_assessment).content

        # A trilha com diagnóstico de baixa familiaridade DEVE ter outro TG-1.
        assert without_content.tickets[0].title != with_content.tickets[0].title
        # O ticket fundacional cita a resposta do aluno.
        assert "Nunca usei FastAPI" in (
            with_content.tickets[0].personalization_notes or ""
        )


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
    """Conclusão acontece via tickets — a trilha auto-conclui em 100%."""

    @staticmethod
    def _complete_all_tickets(service, user, trail):
        """Marca todos os tickets como concluídos e devolve a última resposta."""
        content = service.to_read_model(trail).content
        last = None
        for ticket in content.tickets:
            last = service.set_ticket_completion(
                user, trail.id, ticket.code, completed=True
            )
        return last

    def test_complete_marks_trail_and_adds_concepts_as_skills(
        self, service, user_a, skill_service
    ):
        trail = service.create_for_user(user_a, topic="FastAPI")
        # antes: usuário não tem skills
        assert list(skill_service.list_for_user(user_a)) == []

        completed, trail_completed_now, added, _ = self._complete_all_tickets(
            service, user_a, trail
        )

        assert trail_completed_now is True
        assert completed.completed_at is not None
        assert added  # novos conceitos viraram skills
        skills = {s.name for s in skill_service.list_for_user(user_a)}
        assert all(name in skills for name in added)

    def test_complete_upgrades_existing_skill_below_target(
        self, service, user_a, skill_service
    ):
        # Cria a skill em nível novice; conclusão deve elevar para beginner (2).
        # Usamos "testes unitários" porque é uma das categorias em que o
        # FakeProvider colapsa os concepts de TDD/pytest/etc.
        skill_service.add_for_user(user_a, name="testes unitários", proficiency=1)

        trail = service.create_for_user(user_a, topic="Ruby")
        _, _, _, upgraded = self._complete_all_tickets(service, user_a, trail)

        assert "testes unitários" in upgraded
        skill = next(
            s
            for s in skill_service.list_for_user(user_a)
            if s.name == "testes unitários"
        )
        assert skill.proficiency == 2

    def test_completing_individual_ticket_does_not_complete_trail(
        self, service, user_a, skill_service
    ):
        trail = service.create_for_user(user_a, topic="Go")
        content = service.to_read_model(trail).content
        first_code = content.tickets[0].code

        result_trail, trail_completed_now, added, upgraded = (
            service.set_ticket_completion(user_a, trail.id, first_code, completed=True)
        )

        assert trail_completed_now is False
        assert result_trail.completed_at is None
        assert added == [] and upgraded == []
        # E nenhuma skill foi aplicada.
        assert list(skill_service.list_for_user(user_a)) == []

    def test_completing_ticket_twice_is_idempotent(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Rust")
        content = service.to_read_model(trail).content
        code = content.tickets[0].code

        service.set_ticket_completion(user_a, trail.id, code, completed=True)
        _, trail_completed_now, added, upgraded = service.set_ticket_completion(
            user_a, trail.id, code, completed=True
        )

        # Segunda chamada não dispara auto-conclusão nem duplica skills.
        assert trail_completed_now is False
        assert added == [] and upgraded == []

    def test_uncompleting_ticket_reopens_trail(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Zig")
        self._complete_all_tickets(service, user_a, trail)
        # Trilha está concluída.
        completed_at = service.get_for_user(user_a, trail.id).completed_at
        assert completed_at is not None

        # Desmarcar qualquer ticket reabre a trilha.
        first_code = service.to_read_model(trail).content.tickets[0].code
        reopened, _, _, _ = service.set_ticket_completion(
            user_a, trail.id, first_code, completed=False
        )
        assert reopened.completed_at is None

    def test_complete_unknown_ticket_raises(self, service, user_a):
        trail = service.create_for_user(user_a, topic="Nim")
        with pytest.raises(NotFoundError):
            service.set_ticket_completion(
                user_a, trail.id, "TG-999", completed=True
            )

    def test_create_populates_skill_categories_and_complete_uses_them(
        self, service, user_a, skill_service
    ):
        """Garante que skills no perfil são as categorias genéricas, não os concepts."""
        trail = service.create_for_user(user_a, topic="FastAPI com JWT")
        content = service.to_read_model(trail).content

        # 1. create já populou as categorias genéricas
        assert content.skill_categories, "skill_categories não foi populado"
        raw_concepts: list[str] = []
        for ticket in content.tickets:
            raw_concepts.extend(ticket.concepts)
        assert len(content.skill_categories) <= len(raw_concepts)
        assert all(c == c.lower() for c in content.skill_categories)

        # 2. completar TODOS os tickets aplica as categorias
        _, _, added, _ = self._complete_all_tickets(service, user_a, trail)
        skills = {s.name for s in skill_service.list_for_user(user_a)}
        assert set(added) == set(content.skill_categories)
        assert all(cat in skills for cat in content.skill_categories)
        assert "tdd" not in skills
        assert "jwt" not in skills
        assert "testes" not in skills
        assert "autenticação" not in skills


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


@pytest.mark.unit
class TestExplainConceptCache:
    """Garante que o cache persistido evita chamadas redundantes à IA."""

    def _spy_provider(self, fake_ai_provider):
        """Wrap o provider para contar quantas vezes explain_concept é chamado."""
        calls = {"count": 0}
        original = fake_ai_provider.explain_concept

        def counted(*args, **kwargs):
            calls["count"] += 1
            return original(*args, **kwargs)

        fake_ai_provider.explain_concept = counted
        return calls

    def test_second_call_returns_from_cache(self, service, user_a, fake_ai_provider):
        calls = self._spy_provider(fake_ai_provider)
        trail = service.create_for_user(user_a, topic="Erlang")
        ticket = service.to_read_model(trail).content.tickets[0]
        concept = ticket.concepts[0]

        first = service.explain_concept_for_user(user_a, trail.id, ticket.code, concept)
        second = service.explain_concept_for_user(user_a, trail.id, ticket.code, concept)

        assert calls["count"] == 1  # cache evita a segunda chamada
        assert first.model_dump() == second.model_dump()

    def test_force_refresh_bypasses_cache(self, service, user_a, fake_ai_provider):
        calls = self._spy_provider(fake_ai_provider)
        trail = service.create_for_user(user_a, topic="Erlang")
        ticket = service.to_read_model(trail).content.tickets[0]
        concept = ticket.concepts[0]

        service.explain_concept_for_user(user_a, trail.id, ticket.code, concept)
        service.explain_concept_for_user(
            user_a, trail.id, ticket.code, concept, force_refresh=True
        )

        assert calls["count"] == 2

    def test_regenerate_invalidates_cache(self, service, user_a, fake_ai_provider):
        calls = self._spy_provider(fake_ai_provider)
        trail = service.create_for_user(user_a, topic="Erlang")
        ticket = service.to_read_model(trail).content.tickets[0]
        concept = ticket.concepts[0]

        service.explain_concept_for_user(user_a, trail.id, ticket.code, concept)
        assert calls["count"] == 1

        service.regenerate_for_user(user_a, trail.id)
        regenerated_ticket = service.to_read_model(
            service.get_for_user(user_a, trail.id)
        ).content.tickets[0]

        service.explain_concept_for_user(
            user_a, trail.id, regenerated_ticket.code, regenerated_ticket.concepts[0]
        )
        assert calls["count"] == 2

    def test_cache_isolated_per_trail(self, service, user_a, fake_ai_provider):
        calls = self._spy_provider(fake_ai_provider)
        trail_a = service.create_for_user(user_a, topic="Haskell")
        trail_b = service.create_for_user(user_a, topic="Crystal")
        ticket_a = service.to_read_model(trail_a).content.tickets[0]
        ticket_b = service.to_read_model(trail_b).content.tickets[0]

        # mesmo conceito ("Ambiente de desenvolvimento" do TG-1), trilhas
        # distintas: deve gerar duas vezes.
        service.explain_concept_for_user(
            user_a, trail_a.id, ticket_a.code, ticket_a.concepts[0]
        )
        service.explain_concept_for_user(
            user_a, trail_b.id, ticket_b.code, ticket_b.concepts[0]
        )
        assert calls["count"] == 2
