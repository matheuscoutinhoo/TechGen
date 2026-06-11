"""Schemas Pydantic relacionados a trilhas de aprendizado.

Representam a estrutura pedagógica obrigatória: projeto + tickets estilo Jira.
Inclui também o diagnóstico inicial: a IA pergunta ao aluno para calibrar
profundidade, pré-requisitos e ordem dos tickets antes de gerar a trilha.
"""
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TrailCreationMode(str, Enum):
    """Como o aluno descreveu o que quer aprender.

    - ``topic``: ele dita um tema; a IA propõe o projeto inteiro (modo original).
    - ``project``: ele dita o ESCOPO de um projeto + as TECNOLOGIAS que quer
      praticar; a IA monta a trilha em volta disso, mas com liberdade de
      acrescentar conceitos que a stack escolhida exige (não fica refém da
      lista).
    """

    TOPIC = "topic"
    PROJECT = "project"


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
    """Entrada para pedir a PRÓXIMA pergunta do diagnóstico adaptativo (modo TOPIC).

    O cliente envia o que já foi respondido até agora; a IA decide a próxima
    pergunta com base nesse histórico, sondando lacunas reais. Quando a IA
    decide que já tem contexto suficiente, retorna ``done=True``.
    """
    topic: str = Field(min_length=3, max_length=200)
    previous_answers: list[TopicAnswer] = Field(default_factory=list, max_length=10)


class ProjectNextQuestionRequest(BaseModel):
    """Entrada para pedir a PRÓXIMA pergunta do diagnóstico adaptativo (modo PROJECT).

    Carrega o escopo do projeto + as tecnologias declaradas pelo aluno, para
    que a IA possa fazer perguntas calibradas pela stack escolhida e pelo
    nível de complexidade do que ele quer construir.
    """
    project_scope: str = Field(min_length=20, max_length=2000)
    technologies: list[str] = Field(default_factory=list, max_length=15)
    previous_answers: list[TopicAnswer] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _require_technologies(self) -> "ProjectNextQuestionRequest":
        cleaned = _clean_technologies(self.technologies)
        if not cleaned:
            raise ValueError("Informe ao menos uma tecnologia.")
        self.technologies = cleaned
        return self


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
    # Quando o aluno marca o ticket como concluído. Persistido dentro do
    # JSON da trilha (TrailContent.tickets[*].completed_at). Quando TODOS
    # os tickets estão concluídos, a trilha auto-conclui.
    completed_at: datetime | None = None


class TrailContent(BaseModel):
    """Conteúdo pedagógico estruturado de uma trilha."""
    project_title: str = Field(min_length=3, max_length=200)
    project_summary: str = Field(min_length=10, max_length=4000)
    why_realistic: str = Field(min_length=10, max_length=2000)
    target_audience: str = Field(min_length=5, max_length=500)
    prerequisites: list[str] = Field(default_factory=list)
    # Descreve, em termos concretos, o artefato que o aluno tem em mãos quando
    # o último ticket é fechado (URL, comando, demo, arquivo gerado, etc.).
    # Default vazio para retrocompatibilidade com trilhas geradas antes do
    # campo existir; novas trilhas SEMPRE preenchem.
    final_deliverable: str = Field(default="", max_length=2000)
    # Conjunto pequeno e genérico de skills que o aluno vai adicionar/elevar
    # ao concluir a trilha. Gerado por IA a partir dos `concepts` de cada
    # ticket — abstrai dezenas de conceitos específicos em poucos rótulos
    # transferíveis (ex.: "git", "python", "banco de dados").
    # Vazio em trilhas geradas antes do campo existir.
    skill_categories: list[str] = Field(default_factory=list, max_length=15)
    tickets: list[Ticket] = Field(min_length=1)


def _clean_technologies(raw: list[str]) -> list[str]:
    """Normaliza a lista de tecnologias: trim, remove vazios, dedup case-insensitive."""
    seen: set[str] = set()
    out: list[str] = []
    for item in raw or []:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()
        if not cleaned:
            continue
        key = cleaned.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(cleaned)
    return out


class LearningTrailCreate(BaseModel):
    """Entrada para criar uma trilha — dois modos.

    - **TOPIC** (default): ``topic`` é o tema bruto e a IA propõe o projeto.
    - **PROJECT**: ``project_scope`` descreve o que o aluno quer construir e
      ``technologies`` é a lista de stacks que ele quer aprender no caminho.
      A IA usa a stack como guia, mas tem liberdade de cobrir pré-requisitos
      e conceitos fora dela quando o projeto exigir.

    ``assessment`` é a lista de respostas do diagnóstico inicial (vazia
    quando o aluno pulou todas as perguntas), usada pela IA para calibrar
    profundidade e pré-requisitos. O formato é igual nos dois modos.
    """
    mode: TrailCreationMode = TrailCreationMode.TOPIC
    topic: str | None = Field(default=None, max_length=200)
    project_scope: str | None = Field(default=None, max_length=2000)
    technologies: list[str] = Field(default_factory=list, max_length=15)
    assessment: list[TopicAnswer] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _validate_mode_fields(self) -> "LearningTrailCreate":
        if self.mode == TrailCreationMode.TOPIC:
            cleaned_topic = (self.topic or "").strip()
            if len(cleaned_topic) < 3:
                raise ValueError(
                    "No modo 'topic', 'topic' precisa ter ao menos 3 caracteres."
                )
            self.topic = cleaned_topic
            # Limpa campos do outro modo para não vazarem na persistência.
            self.project_scope = None
            self.technologies = []
        else:  # PROJECT
            cleaned_scope = (self.project_scope or "").strip()
            if len(cleaned_scope) < 20:
                raise ValueError(
                    "No modo 'project', 'project_scope' precisa ter ao menos 20 caracteres."
                )
            cleaned_tech = _clean_technologies(self.technologies)
            if not cleaned_tech:
                raise ValueError(
                    "No modo 'project' informe ao menos uma tecnologia."
                )
            self.project_scope = cleaned_scope
            self.technologies = cleaned_tech
            self.topic = None
        return self


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
    """Versão enxuta para listagem.

    Não carrega o ``content`` inteiro — mas expõe contagem de tickets total e
    concluídos pra que a UI consiga mostrar progresso resumido sem precisar
    de uma segunda chamada por trilha.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    topic: str
    title: str
    summary: str
    completed_at: datetime | None = None
    ticket_count: int = 0
    completed_ticket_count: int = 0
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


class CompleteTicketResponse(BaseModel):
    """Resultado de marcar/desmarcar um ticket.

    Quando o ticket marcado fez a trilha alcançar 100% de tickets concluídos,
    a trilha auto-conclui e ``trail_completed=True`` + ``added_concepts``/
    ``upgraded_concepts`` carregam o que entrou no perfil. Caso contrário,
    ``trail_completed=False`` e as listas vêm vazias.
    """
    trail: LearningTrailRead
    trail_completed: bool = False
    added_concepts: list[str] = Field(default_factory=list)
    upgraded_concepts: list[str] = Field(default_factory=list)
