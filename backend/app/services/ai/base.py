"""Interface de provider de IA.

Qualquer implementação (Abacus, OpenAI, mock, etc.) deve conformar com
``AIProvider``. Services só dependem desta interface.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Sequence

from app.schemas.learning_trail import ConceptExplanation, TrailContent


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
    def generate_learning_trail(
        self,
        topic: str,
        *,
        skills: Sequence[UserSkillInput] = (),
    ) -> TrailContent:
        """Gera uma trilha estruturada para o tema e nivelamento fornecidos."""

    @abstractmethod
    def explain_concept(
        self,
        concept: str,
        *,
        context: ConceptContext,
        skills: Sequence[UserSkillInput] = (),
    ) -> ConceptExplanation:
        """Gera uma explicação aprofundada de um conceito no contexto de um ticket."""
