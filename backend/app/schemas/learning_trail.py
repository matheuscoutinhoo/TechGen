"""Schemas Pydantic relacionados a trilhas de aprendizado.

Representam a estrutura pedagógica obrigatória: projeto + tickets estilo Jira.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TicketTask(BaseModel):
    """Tarefa pontual dentro de um ticket."""
    description: str = Field(min_length=1, max_length=500)


class Ticket(BaseModel):
    """Ticket estilo Jira: unidade incremental de aprendizado."""
    code: str = Field(min_length=1, max_length=20, description="Ex.: TG-1, TG-2")
    title: str = Field(min_length=3, max_length=200)
    objective: str = Field(min_length=10, max_length=2000)
    personalization_notes: str | None = Field(default=None, max_length=2000)
    concepts: list[str] = Field(default_factory=list)
    tasks: list[TicketTask] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    estimated_effort: str | None = Field(default=None, max_length=50)


class TrailContent(BaseModel):
    """Conteúdo pedagógico estruturado de uma trilha."""
    project_title: str = Field(min_length=3, max_length=200)
    project_summary: str = Field(min_length=10, max_length=4000)
    why_realistic: str = Field(min_length=10, max_length=2000)
    target_audience: str = Field(min_length=5, max_length=500)
    prerequisites: list[str] = Field(default_factory=list)
    tickets: list[Ticket] = Field(min_length=1)


class LearningTrailCreate(BaseModel):
    """Entrada para criar uma trilha — usuário só informa o tema."""
    topic: str = Field(min_length=3, max_length=200)


class LearningTrailUpdate(BaseModel):
    """Edição manual da trilha pelo usuário."""
    title: str | None = Field(default=None, min_length=3, max_length=200)
    summary: str | None = Field(default=None, min_length=10, max_length=4000)
    content: TrailContent | None = None


class LearningTrailRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic: str
    title: str
    summary: str
    content: TrailContent
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class LearningTrailListItem(BaseModel):
    """Versão enxuta para listagem (não carrega tickets completos)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic: str
    title: str
    summary: str
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class ConceptExample(BaseModel):
    """Exemplo de uso pertencente a uma explicação de conceito."""
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(min_length=10, max_length=2000)
    code: str | None = Field(default=None, max_length=4000)


class GlossaryEntry(BaseModel):
    """Termo secundário citado na explicação, com breve definição.

    O frontend usa para criar tooltips em conceitos-satélite (ex.: ``router``,
    ``middleware``) que aparecem dentro do texto sem desviar o aluno do tema
    principal.
    """
    term: str = Field(min_length=1, max_length=80)
    brief: str = Field(min_length=10, max_length=400)


class ConceptExplanation(BaseModel):
    """Explicação pedagógica aprofundada de um conceito de um ticket."""
    concept: str = Field(min_length=1, max_length=200)
    definition: str = Field(min_length=20, max_length=4000)
    why_it_matters: str = Field(min_length=10, max_length=2000)
    patterns: list[str] = Field(default_factory=list, max_length=10)
    examples: list[ConceptExample] = Field(default_factory=list, max_length=5)
    hands_on_steps: list[str] = Field(min_length=3, max_length=10)
    tips: list[str] = Field(default_factory=list, max_length=10)
    pitfalls: list[str] = Field(default_factory=list, max_length=10)
    further_reading: list[str] = Field(default_factory=list, max_length=10)
    glossary: list[GlossaryEntry] = Field(default_factory=list, max_length=12)


class CompleteTrailResponse(BaseModel):
    """Resultado de concluir uma trilha: trilha atualizada + skills afetadas."""
    trail: LearningTrailRead
    added_concepts: list[str] = Field(default_factory=list)
    upgraded_concepts: list[str] = Field(default_factory=list)
