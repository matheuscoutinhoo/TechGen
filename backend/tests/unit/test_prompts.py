"""Testes dos builders de prompt — foco no mecanismo de diversidade.

Garante que o mesmo tema/escopo NÃO gere sempre o mesmo prompt (o que levava
o modelo a propor sempre o mesmo projeto) e que as diretivas certas são
injetadas em cada modo.
"""
import pytest

from app.schemas.learning_trail import TopicAnswer
from app.services.ai.prompts import (
    PROJECT_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_project_user_prompt,
    build_user_prompt,
)


@pytest.mark.unit
class TestEfficiencyDirective:
    """A diretiva de densidade reduz desperdício (geração mais rápida) sem
    abrir mão da profundidade técnica — deve estar presente nos dois modos."""

    def test_system_prompts_carry_efficiency_block(self):
        for sys_prompt in (SYSTEM_PROMPT, PROJECT_SYSTEM_PROMPT):
            assert "EFICIÊNCIA" in sys_prompt
            assert "JSON COMPACTO" in sys_prompt
            # Preserva substância: não pode cortar profundidade técnica.
            assert "PRESERVAR" in sys_prompt

    def test_user_prompts_carry_density_rule(self):
        topic = build_user_prompt("API REST com FastAPI")
        project = build_project_user_prompt(
            "Plataforma de doação de livros usados com login e busca",
            technologies=["FastAPI"],
        )
        assert "DENSIDADE" in topic
        assert "DENSIDADE" in project


@pytest.mark.unit
class TestConceptTaskCoverage:
    """Toda tarefa pedida num ticket precisa ter o conceito que a ensina —
    senão o aluno recebe uma task sem material de estudo."""

    def test_system_prompts_require_coverage(self):
        for sys_prompt in (SYSTEM_PROMPT, PROJECT_SYSTEM_PROMPT):
            assert "COBERTURA CONCEITO ↔ TAREFA" in sys_prompt

    def test_user_prompts_require_coverage(self):
        topic = build_user_prompt("API REST com FastAPI")
        project = build_project_user_prompt(
            "Plataforma de doação de livros usados com login e busca",
            technologies=["FastAPI"],
        )
        assert "COBERTURA:" in topic
        assert "COBERTURA:" in project


@pytest.mark.unit
class TestTopicPromptDiversity:
    def test_includes_diversity_block(self):
        prompt = build_user_prompt("API REST com FastAPI")
        assert "DIVERSIDADE E ORIGINALIDADE" in prompt
        assert "seed" in prompt.lower()

    def test_topic_mode_directs_domain_or_subniche(self):
        prompt = build_user_prompt("API REST com FastAPI")
        # No modo TEMA o domínio é sorteado (ancora) ou pede sub-nicho.
        assert "ancore o cenário" in prompt
        assert "SUB-NICHO" in prompt

    def test_varies_across_calls_for_same_topic(self):
        """Cerne do bug reportado: o mesmo tema repetido produzia o mesmo
        projeto. Os prompts agora precisam variar entre chamadas."""
        prompts = {build_user_prompt("API REST com FastAPI") for _ in range(12)}
        # Com seed + domínio + ângulo sorteados, 12 chamadas têm de gerar
        # mais de um prompt distinto (probabilidade de colisão é ínfima).
        assert len(prompts) > 1

    def test_preserves_skills_and_assessment(self):
        prompt = build_user_prompt(
            "API REST com FastAPI",
            [("JWT", 3, "intermediate")],
            [
                TopicAnswer(
                    question_id="q1",
                    question="Já usou FastAPI?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )
        assert "JWT" in prompt
        assert "Nunca usei FastAPI" in prompt


@pytest.mark.unit
class TestProjectPromptDiversity:
    SCOPE = (
        "Plataforma web onde pessoas cadastram livros usados para doação, "
        "com login, busca e ranking de doadores."
    )

    def test_includes_diversity_block(self):
        prompt = build_project_user_prompt(self.SCOPE, technologies=["FastAPI"])
        assert "DIVERSIDADE E ORIGINALIDADE" in prompt

    def test_project_mode_locks_domain(self):
        """No modo PROJECT o domínio é do escopo: a variação não pode trocar
        de domínio, só arquitetura/modelagem/ordem."""
        prompt = build_project_user_prompt(self.SCOPE, technologies=["FastAPI"])
        assert "NÃO troque de domínio" in prompt
        # E NÃO deve pedir para ancorar em outro domínio sorteado.
        assert "ancore o cenário" not in prompt

    def test_varies_across_calls_for_same_scope(self):
        prompts = {
            build_project_user_prompt(self.SCOPE, technologies=["FastAPI"])
            for _ in range(12)
        }
        assert len(prompts) > 1

    def test_preserves_scope_and_technologies(self):
        prompt = build_project_user_prompt(
            self.SCOPE, technologies=["FastAPI", "React"]
        )
        assert "livros usados para doação" in prompt
        assert "FastAPI" in prompt
        assert "React" in prompt
