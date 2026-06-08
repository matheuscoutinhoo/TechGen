"""Schemas Pydantic relacionados a trilhas de aprendizado.

Representam a estrutura pedagógica obrigatória: projeto + tickets estilo Jira.
Inclui também o diagnóstico inicial: a IA pergunta ao aluno para calibrar
profundidade, pré-requisitos e ordem dos tickets antes de gerar a trilha.
"""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ====================================================================== #
# Diagnóstico inicial (pré-trilha)
# ====================================================================== #
class TopicQuestionOption(BaseModel):
    """Alternativa de uma pergunta de diagnóstico."""
    id: str = Field(min_length=1, max_length=10, description="Ex.: 'a', 'b', 'c'")
    label: str = Field(min_length=1, max_length=200)


class TopicQuestion(BaseModel):
    """Pergunta de múltipla escolha que diagnostica o nível do aluno no tema."""
    id: str = Field(min_length=1, max_length=20, description="Ex.: 'q1'")
    question: str = Field(min_length=5, max_length=500)
    rationale: str = Field(min_length=5, max_length=400)
    options: list[TopicQuestionOption] = Field(min_length=2, max_length=5)


class TopicAnswer(BaseModel):
    """Resposta do aluno a uma pergunta do diagnóstico.

    Carregamos o texto da pergunta + texto da alternativa escolhida para que
    o prompt da trilha receba contexto humano (não só ids).
    """
    question_id: str = Field(min_length=1, max_length=20)
    question: str = Field(min_length=1, max_length=500)
    answer: str = Field(min_length=1, max_length=500)


class TopicNextQuestionRequest(BaseModel):
    """Entrada para pedir a PRÓXIMA pergunta do diagnóstico adaptativo.

    O cliente envia o que já foi respondido até agora; a IA decide a próxima
    pergunta com base nesse histórico, sondando lacunas reais. Quando a IA
    decide que já tem contexto suficiente, retorna ``done=True``.
    """
    topic: str = Field(min_length=3, max_length=200)
    previous_answers: list[TopicAnswer] = Field(default_factory=list, max_length=10)


class TopicNextQuestionResponse(BaseModel):
    """Resposta do endpoint adaptativo: próxima pergunta ou sinal de fim."""
    question: TopicQuestion | None = None
    done: bool = False


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
    """Entrada para criar uma trilha.

    O ``topic`` é o tema bruto do aluno. ``assessment`` é a lista de respostas
    do diagnóstico inicial (vazia quando o aluno pulou todas as perguntas),
    usada pela IA para calibrar profundidade e pré-requisitos.
    """
    topic: str = Field(min_length=3, max_length=200)
    assessment: list[TopicAnswer] = Field(default_factory=list, max_length=10)


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
