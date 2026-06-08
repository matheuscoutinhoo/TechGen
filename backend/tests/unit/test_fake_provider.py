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
class TestProjectDeliveryClosure:
    """Invariante: a trilha SEMPRE termina entregando o projeto descrito."""

    # Temas variados para exercitar diferentes seeds e contagens de tickets.
    TOPICS = [
        "FastAPI",
        "Kubernetes",
        "Rust",
        "Streaming Kafka",
        "Dashboard React",
        "CLI em Go",
    ]

    # Heurística mínima: o ticket de fechamento precisa carregar uma palavra
    # de release no título OU "Validação end-to-end" nos conceitos.
    CLOSURE_KEYWORDS = (
        "release",
        "entrega",
        "capstone",
        "demo",
        "ponta a ponta",
        "end-to-end",
        "versão 1.0",
        "publica",
    )

    @pytest.mark.parametrize("topic", TOPICS)
    def test_last_ticket_is_capstone_release(self, topic):
        provider = FakeAIProvider()
        content = provider.generate_learning_trail(topic)
        last = content.tickets[-1]
        title_lower = last.title.lower()
        assert any(
            keyword in title_lower for keyword in self.CLOSURE_KEYWORDS
        ), f"Trilha de '{topic}' não termina em ticket de release. Último: {last.title!r}"

    @pytest.mark.parametrize("topic", TOPICS)
    def test_last_ticket_acceptance_validates_full_deliverable(self, topic):
        """O último ticket precisa ter um acceptance criterion que valide o todo."""
        provider = FakeAIProvider()
        content = provider.generate_learning_trail(topic)
        last = content.tickets[-1]
        joined = " ".join(last.acceptance_criteria).lower()
        # Pelo menos UM critério precisa amarrar a entrega ao project_summary
        # OU exigir reprodutibilidade end-to-end.
        assert (
            "project_summary" in joined
            or "resumo" in joined
            or "end-to-end" in joined
            or "ponta a ponta" in joined
            or "reproduzir" in joined
            or "outra pessoa" in joined
        ), f"Acceptance do capstone para '{topic}' não valida a entrega: {last.acceptance_criteria}"

    @pytest.mark.parametrize("topic", TOPICS)
    def test_last_ticket_is_never_roadmap(self, topic):
        """Anti-regressão: 'próximos passos' / 'roadmap' não pode ser o ticket final."""
        provider = FakeAIProvider()
        content = provider.generate_learning_trail(topic)
        last = content.tickets[-1]
        forbidden = ("próximos passos", "roadmap", "evolução futura", "ideias futuras")
        title_lower = last.title.lower()
        assert not any(
            word in title_lower for word in forbidden
        ), f"Ticket final virou roadmap em '{topic}': {last.title!r}"

    @pytest.mark.parametrize("topic", TOPICS)
    def test_final_deliverable_is_populated_and_concrete(self, topic):
        provider = FakeAIProvider()
        content = provider.generate_learning_trail(topic)
        assert content.final_deliverable, "final_deliverable está vazio"
        # Tem que citar o tema concreto, não pode ser texto genérico.
        assert topic.lower() in content.final_deliverable.lower()

    def test_capstone_present_even_when_foundation_path_triggers(self):
        """Path fundacional (aluno iniciante) também termina em capstone."""
        provider = FakeAIProvider()
        content = provider.generate_learning_trail(
            "API design com FastAPI",
            assessment=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )
        # TG-1 é fundacional
        assert "Primeiros passos" in content.tickets[0].title
        # Último ainda é o capstone
        last = content.tickets[-1]
        assert any(k in last.title.lower() for k in self.CLOSURE_KEYWORDS)
        assert content.final_deliverable
        assert "FastAPI" in content.final_deliverable

    def test_capstone_codes_are_sequential(self):
        provider = FakeAIProvider()
        content = provider.generate_learning_trail("FastAPI")
        for i, ticket in enumerate(content.tickets, start=1):
            assert ticket.code == f"TG-{i}"

    def test_regenerate_preserves_capstone_invariant(self):
        """Regerar a trilha (e.g., a IA reroda) ainda termina em capstone."""
        provider = FakeAIProvider()
        a = provider.generate_learning_trail("Docker")
        b = provider.generate_learning_trail("Docker")
        for content in (a, b):
            last = content.tickets[-1]
            assert any(k in last.title.lower() for k in self.CLOSURE_KEYWORDS)

    def test_low_familiarity_assessment_produces_longer_trail(self):
        """Aluno iniciante recebe MAIS tickets para dissecar o tema."""
        provider = FakeAIProvider()
        topic = "API design com FastAPI"

        baseline = provider.generate_learning_trail(topic)
        with_low = provider.generate_learning_trail(
            topic,
            assessment=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )

        # Iniciante recebe pelo menos 50% mais tickets para cobrir fundamentos.
        assert len(with_low.tickets) > len(baseline.tickets)
        assert len(with_low.tickets) >= 12
        # Mas ainda respeitando o teto duro de 20.
        assert len(with_low.tickets) <= 20

    @pytest.mark.parametrize("topic", TOPICS)
    def test_trail_size_stays_within_contract_bounds(self, topic):
        """Toda trilha gerada precisa caber entre 6 e 20 tickets."""
        provider = FakeAIProvider()
        content = provider.generate_learning_trail(topic)
        assert 6 <= len(content.tickets) <= 20


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
