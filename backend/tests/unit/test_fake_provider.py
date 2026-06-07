"""Testes unitários do FakeAIProvider — garantia de saída pedagógica correta."""
import pytest

from app.schemas.learning_trail import ConceptExplanation, TrailContent
from app.services.ai.base import ConceptContext, UserSkillInput
from app.services.ai.fake_provider import FakeAIProvider


@pytest.mark.unit
class TestFakeAIProvider:
    def test_generates_valid_trail_content_for_any_topic(self):
        provider = FakeAIProvider()
        content = provider.generate_learning_trail("FastAPI avançado")
        assert isinstance(content, TrailContent)
        assert content.project_title.startswith("Plataforma")
        assert len(content.tickets) >= 6
        for index, ticket in enumerate(content.tickets, start=1):
            assert ticket.code == f"TG-{index}"
            assert ticket.title
            assert ticket.objective
            assert ticket.concepts
            assert ticket.tasks
            assert ticket.acceptance_criteria
            assert ticket.personalization_notes

    def test_output_is_deterministic_per_topic(self):
        provider = FakeAIProvider()
        a = provider.generate_learning_trail("Redes neurais")
        b = provider.generate_learning_trail("Redes neurais")
        assert a.model_dump() == b.model_dump()

    def test_different_topics_produce_different_titles(self):
        provider = FakeAIProvider()
        a = provider.generate_learning_trail("Kubernetes")
        b = provider.generate_learning_trail("Rust")
        assert a.project_title != b.project_title

    def test_personalization_reflects_user_skills(self):
        provider = FakeAIProvider()
        skills = [UserSkillInput(name="TDD", level=3, label="intermediate")]
        content = provider.generate_learning_trail("Python", skills=skills)
        # ao menos um ticket deve mencionar TDD na nota de personalização
        notes = " ".join(t.personalization_notes or "" for t in content.tickets)
        assert "TDD" in notes
        assert "intermediate" in content.target_audience


@pytest.mark.unit
class TestExplainConcept:
    def test_returns_full_explanation(self):
        provider = FakeAIProvider()
        explanation = provider.explain_concept(
            "Repository",
            context=ConceptContext(
                project_title="Plataforma de Reservas",
                ticket_title="Persistência",
                ticket_objective="Implementar repositório de reservas.",
            ),
        )
        assert isinstance(explanation, ConceptExplanation)
        assert explanation.concept == "Repository"
        assert explanation.definition
        assert explanation.patterns
        assert explanation.pitfalls
        assert explanation.tips
        assert explanation.examples

    def test_explanation_calibrates_when_skill_is_advanced(self):
        provider = FakeAIProvider()
        skills = [UserSkillInput(name="Repository", level=4, label="advanced")]
        explanation = provider.explain_concept(
            "Repository",
            context=ConceptContext(
                project_title="X",
                ticket_title="Y",
                ticket_objective="Objetivo claro.",
            ),
            skills=skills,
        )
        assert "advanced" in explanation.definition
