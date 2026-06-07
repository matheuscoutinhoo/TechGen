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
    created_at: datetime
    updated_at: datetime


class LearningTrailListItem(BaseModel):
    """Versão enxuta para listagem (não carrega tickets completos)."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic: str
    title: str
    summary: str
    created_at: datetime
    updated_at: datetime
