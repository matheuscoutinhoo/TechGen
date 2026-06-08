"""Testes unitários do FakeAIProvider — garantia de saída pedagógica correta."""
import pytest

from app.schemas.learning_trail import (
    ConceptExplanation,
    TopicAnswer,
    TopicQuestion,
    TrailContent,
)
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

    def test_assessment_answers_appear_in_personalization(self):
        provider = FakeAIProvider()
        answers = [
            TopicAnswer(
                question_id="q1",
                question="Você já usou FastAPI?",
                answer="Nunca usei FastAPI",
            )
        ]
        content = provider.generate_learning_trail(
            "API com FastAPI", assessment=answers
        )
        joined = " ".join(t.personalization_notes or "" for t in content.tickets)
        assert "Nunca usei FastAPI" in joined
        assert "diagnóstico" in content.target_audience.lower() or "1 resposta" in content.target_audience

    def test_low_familiarity_assessment_forces_foundational_first_ticket(self):
        """Prova que o assessment muda a trilha: aluno iniciante recebe ticket fundacional."""
        provider = FakeAIProvider()
        topic = "API design com FastAPI"

        # Sem assessment: TG-1 é o ticket genérico "Setup do ambiente".
        without = provider.generate_learning_trail(topic)
        # Com assessment indicando "Nunca usei FastAPI": TG-1 vira fundacional.
        with_assessment = provider.generate_learning_trail(
            topic,
            assessment=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )

        assert without.tickets[0].title != with_assessment.tickets[0].title
        assert "Primeiros passos" in with_assessment.tickets[0].title
        assert "Pré-requisitos da stack" in with_assessment.tickets[0].concepts
        assert "Nunca usei FastAPI" in (
            with_assessment.tickets[0].personalization_notes or ""
        )

    def test_advanced_assessment_keeps_normal_progression(self):
        """Aluno fluente NÃO recebe ticket fundacional — só a sequência padrão."""
        provider = FakeAIProvider()
        content = provider.generate_learning_trail(
            "API design com FastAPI",
            assessment=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Uso FastAPI no dia a dia",
                )
            ],
        )
        assert "Primeiros passos" not in content.tickets[0].title


@pytest.mark.unit
class TestAdaptiveQuestions:
    def test_first_question_is_familiarity(self):
        provider = FakeAIProvider()
        question = provider.generate_next_topic_question("FastAPI")
        assert isinstance(question, TopicQuestion)
        assert question.id == "q1"
        # primeira pergunta sempre sonda familiaridade
        assert "trabalhou" in question.question.lower() or "usou" in question.question.lower()
        # alternativas devem citar o tema explicitamente em pelo menos uma opção
        joined = " ".join(opt.label for opt in question.options)
        assert "FastAPI" in joined

    def test_second_question_changes_based_on_previous_answer(self):
        """Pergunta seguinte deve ser DIFERENTE conforme a resposta anterior."""
        provider = FakeAIProvider()
        topic = "FastAPI"

        # Caminho A: aluno marcou "Nunca usei FastAPI" → next deve sondar
        # fundamento (pré-requisito).
        low_path = provider.generate_next_topic_question(
            topic,
            previous_answers=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )

        # Caminho B: aluno marcou "Uso FastAPI no dia a dia" → next deve
        # sondar trade-offs (nível avançado).
        high_path = provider.generate_next_topic_question(
            topic,
            previous_answers=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Uso FastAPI no dia a dia",
                )
            ],
        )

        assert low_path is not None
        assert high_path is not None
        # IDs sequenciais
        assert low_path.id == "q2"
        assert high_path.id == "q2"
        # E são perguntas diferentes!
        assert low_path.question != high_path.question
        assert "linguagem" in low_path.question.lower() or "base" in low_path.question.lower()
        assert "trade" in high_path.question.lower() or "trade-off" in high_path.question.lower()

    def test_provider_returns_none_after_max_questions(self):
        provider = FakeAIProvider()
        # 5 respostas variadas → próximo deve ser None (teto duro)
        previous = [
            TopicAnswer(question_id=f"q{i}", question=f"P{i}?", answer=f"R{i}")
            for i in range(1, 6)
        ]
        result = provider.generate_next_topic_question("X", previous_answers=previous)
        assert result is None

    def test_provider_stops_when_context_is_sufficient(self):
        """Após 3 respostas, o fake provider encerra."""
        provider = FakeAIProvider()
        previous = [
            TopicAnswer(question_id=f"q{i}", question=f"P{i}?", answer=f"R{i}")
            for i in range(1, 4)
        ]
        assert (
            provider.generate_next_topic_question("X", previous_answers=previous)
            is None
        )


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
