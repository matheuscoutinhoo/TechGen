"""Interface de provider de IA.

Qualquer implementação (Abacus, OpenAI, mock, etc.) deve conformar com
``AIProvider``. Services só dependem desta interface.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Sequence

from app.schemas.learning_trail import (
    ConceptExplanation,
    TopicAnswer,
    TopicQuestion,
    TrailContent,
)


@dataclass(frozen=True)
class UserSkillInput:
    """Snapshot mínimo de uma skill para personalizar prompts."""
    name: str
    level: int
    label: str


@dataclass(frozen=True)
class ConceptContext:
    """Contexto pedagógico passado ao provider ao explicar um conceito."""
    project_title: str
    ticket_title: str
    ticket_objective: str


class AIProvider(ABC):
    """Contrato para provedores de IA usados na geração de trilhas."""

    @abstractmethod
    def generate_next_topic_question(
        self,
        topic: str,
        *,
        skills: Sequence[UserSkillInput] = (),
        previous_answers: Sequence[TopicAnswer] = (),
    ) -> TopicQuestion | None:
        """Gera a PRÓXIMA pergunta de diagnóstico (adaptativa).

        A IA recebe o histórico de respostas e decide a próxima sondagem com
        base nelas: confirma uma hipótese, esclarece uma ambiguidade ou cobre
        um pré-requisito ainda não tocado. Retorna ``None`` quando considera
        que já tem contexto suficiente para gerar a trilha.

        O service garante um teto rígido de 5 perguntas independentemente do
        que a IA retornar.
        """

    @abstractmethod
    def generate_learning_trail(
        self,
        topic: str,
        *,
        skills: Sequence[UserSkillInput] = (),
        assessment: Sequence[TopicAnswer] = (),
    ) -> TrailContent:
        """Gera uma trilha estruturada para o tema e nivelamento fornecidos.

        ``assessment`` carrega as respostas do diagnóstico inicial. Quando
        presente, deve ditar a decomposição em tickets e os pré-requisitos
        cobertos.
        """

    @abstractmethod
    def explain_concept(
        self,
        concept: str,
        *,
        context: ConceptContext,
        skills: Sequence[UserSkillInput] = (),
    ) -> ConceptExplanation:
        """Gera uma explicação aprofundada de um conceito no contexto de um ticket."""

    @abstractmethod
    def categorize_concepts(self, concepts: Sequence[str]) -> list[str]:
        """Abstrai uma lista de concepts específicos em poucas skills genéricas.

        Ex.: ``["JWT", "OAuth2", "Repository Pattern", "Migrations"]`` vira
        ``["autenticação", "banco de dados"]``. Usado na conclusão da trilha
        para evitar poluir o perfil do aluno com dezenas de termos pontuais.

        Retorna lista deduplicada, em lowercase, com no máximo ~8 categorias.
        """

