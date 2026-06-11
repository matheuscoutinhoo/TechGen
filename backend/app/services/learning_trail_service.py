"""Service de trilhas de aprendizado."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Sequence

from pydantic import TypeAdapter, ValidationError

from app.exceptions import ForbiddenError, NotFoundError
from app.exceptions import ValidationError as DomainValidationError
from app.models.learning_trail import LearningTrail
from app.models.skill import PROFICIENCY_LABELS
from app.models.user import User
from app.repositories.concept_explanation_repository import (
    ConceptExplanationRepository,
)
from app.repositories.learning_trail_repository import LearningTrailRepository
from app.schemas.learning_trail import (
    ConceptExplanation,
    LearningTrailListItem,
    LearningTrailRead,
    TopicAnswer,
    TopicNextQuestionResponse,
    TopicQuestion,
    TrailContent,
    TrailCreationMode,
)
from app.services.ai.base import AIProvider, ConceptContext, UserSkillInput
from app.services.skill_service import SkillService


_ASSESSMENT_LIST_ADAPTER = TypeAdapter(list[TopicAnswer])

# Teto rígido de perguntas de diagnóstico independente do que a IA retornar.
# Mantém a UX previsível e barra qualquer loop infinito.
MAX_ASSESSMENT_QUESTIONS = 5


def _to_skill_inputs(user: User) -> list[UserSkillInput]:
    return [
        UserSkillInput(
            name=skill.name,
            level=skill.proficiency,
            label=PROFICIENCY_LABELS.get(skill.proficiency, "novice"),
        )
        for skill in (user.skills or [])
    ]


class LearningTrailService:
    def __init__(
        self,
        *,
        repository: LearningTrailRepository,
        ai_provider: AIProvider,
        skill_service: SkillService,
        concept_cache_repository: ConceptExplanationRepository,
    ) -> None:
        self.repository = repository
        self.ai_provider = ai_provider
        self.skill_service = skill_service
        self.concept_cache = concept_cache_repository

    # ------------------------------------------------------------------ #
    # Queries
    # ------------------------------------------------------------------ #
    def list_for_user(self, user: User) -> Sequence[LearningTrail]:
        return self.repository.list_by_user(user.id)

    def get_for_user(self, user: User, trail_id: int) -> LearningTrail:
        trail = self.repository.get(trail_id)
        if trail is None:
            raise NotFoundError("Trilha não encontrada")
        if trail.user_id != user.id:
            raise ForbiddenError("Você não tem acesso a esta trilha")
        return trail

    def build_next_question_for_user(
        self,
        user: User,
        *,
        topic: str,
        previous_answers: Sequence[TopicAnswer] = (),
    ) -> TopicNextQuestionResponse:
        """Pede à IA a PRÓXIMA pergunta do diagnóstico, dado o histórico.

        Aplica o teto rígido de ``MAX_ASSESSMENT_QUESTIONS`` antes mesmo de
        chamar a IA — se o cliente já passou esse limite, encerra direto.
        """
        answers = list(previous_answers)
        if len(answers) >= MAX_ASSESSMENT_QUESTIONS:
            return TopicNextQuestionResponse(question=None, done=True)

        next_question: TopicQuestion | None = (
            self.ai_provider.generate_next_topic_question(
                topic,
                skills=_to_skill_inputs(user),
                previous_answers=answers,
            )
        )
        if next_question is None:
            return TopicNextQuestionResponse(question=None, done=True)
        return TopicNextQuestionResponse(question=next_question, done=False)

    def build_next_project_question_for_user(
        self,
        user: User,
        *,
        project_scope: str,
        technologies: Sequence[str] = (),
        previous_answers: Sequence[TopicAnswer] = (),
    ) -> TopicNextQuestionResponse:
        """Versão PROJECT do diagnóstico adaptativo. Mesma semântica de teto.

        Encaminha escopo + tecnologias para o provider, que calibra a
        pergunta pela stack escolhida e pelas restrições do projeto.
        """
        answers = list(previous_answers)
        if len(answers) >= MAX_ASSESSMENT_QUESTIONS:
            return TopicNextQuestionResponse(question=None, done=True)

        next_question: TopicQuestion | None = (
            self.ai_provider.generate_next_project_question(
                project_scope,
                technologies=technologies,
                skills=_to_skill_inputs(user),
                previous_answers=answers,
            )
        )
        if next_question is None:
            return TopicNextQuestionResponse(question=None, done=True)
        return TopicNextQuestionResponse(question=next_question, done=False)

    # ------------------------------------------------------------------ #
    # Commands
    # ------------------------------------------------------------------ #
    def create_for_user(
        self,
        user: User,
        *,
        topic: str,
        assessment: Sequence[TopicAnswer] = (),
    ) -> LearningTrail:
        content = self.ai_provider.generate_learning_trail(
            topic, skills=_to_skill_inputs(user), assessment=assessment
        )
        content = self._with_skill_categories(content)
        return self.repository.create(
            user_id=user.id,
            topic=topic.strip(),
            title=content.project_title,
            summary=content.project_summary,
            content_json=content.model_dump_json(),
            assessment_json=_serialize_assessment(assessment),
            creation_input_json=_serialize_topic_input(topic),
        )

    def create_project_for_user(
        self,
        user: User,
        *,
        project_scope: str,
        technologies: Sequence[str] = (),
        assessment: Sequence[TopicAnswer] = (),
    ) -> LearningTrail:
        """Cria uma trilha no modo PROJECT.

        O ``topic`` persistido vira o ``project_title`` gerado pela IA, que é
        o rótulo curto usado em listagens e cabeçalhos. O escopo + a stack
        ficam guardados em ``creation_input_json`` pra serem reaproveitados
        em ``regenerate_for_user``.
        """
        techs = list(technologies)
        content = self.ai_provider.generate_project_trail(
            project_scope,
            technologies=techs,
            skills=_to_skill_inputs(user),
            assessment=assessment,
        )
        content = self._with_skill_categories(content)
        return self.repository.create(
            user_id=user.id,
            topic=content.project_title[:200],
            title=content.project_title,
            summary=content.project_summary,
            content_json=content.model_dump_json(),
            assessment_json=_serialize_assessment(assessment),
            creation_input_json=_serialize_project_input(project_scope, techs),
        )

    def regenerate_for_user(self, user: User, trail_id: int) -> LearningTrail:
        trail = self.get_for_user(user, trail_id)
        stored_assessment = _deserialize_assessment(trail.assessment_json)
        creation_input = _deserialize_creation_input(trail.creation_input_json)

        if creation_input and creation_input.get("mode") == TrailCreationMode.PROJECT.value:
            content = self.ai_provider.generate_project_trail(
                creation_input.get("project_scope") or "",
                technologies=creation_input.get("technologies") or [],
                skills=_to_skill_inputs(user),
                assessment=stored_assessment,
            )
            new_topic = content.project_title[:200]
        else:
            # Modo TOPIC (default e fallback para trilhas antigas sem snapshot).
            topic = (
                creation_input.get("topic") if creation_input else None
            ) or trail.topic
            content = self.ai_provider.generate_learning_trail(
                topic,
                skills=_to_skill_inputs(user),
                assessment=stored_assessment,
            )
            new_topic = topic

        content = self._with_skill_categories(content)
        trail.topic = new_topic
        trail.title = content.project_title
        trail.summary = content.project_summary
        trail.content_json = content.model_dump_json()
        trail.completed_at = None
        updated = self.repository.update(trail)
        # Conteúdo da trilha mudou: as explicações antigas perderam contexto.
        self.concept_cache.delete_for_trail(trail.id)
        return updated

    def delete_for_user(self, user: User, trail_id: int) -> None:
        trail = self.get_for_user(user, trail_id)
        self.repository.delete(trail)

    # ------------------------------------------------------------------ #
    # Conclusão de tickets + auto-conclusão da trilha
    # ------------------------------------------------------------------ #
    def set_ticket_completion(
        self,
        user: User,
        trail_id: int,
        ticket_code: str,
        *,
        completed: bool,
    ) -> tuple[LearningTrail, bool, list[str], list[str]]:
        """Marca/desmarca um ticket como concluído. Idempotente.

        Quando ``completed=True`` e todos os tickets da trilha passam a estar
        concluídos, a trilha auto-conclui: ``completed_at`` é setado e as
        ``skill_categories`` viram skills no perfil (apply_concepts no nível
        beginner).

        Quando ``completed=False`` e a trilha estava concluída, "desconclui"
        a trilha (``completed_at`` volta para ``None``). As skills aplicadas
        permanecem no perfil — desfazer aprendizado seria confuso e o aluno
        pode ajustar/remover manualmente em /account se quiser.

        Returns: ``(trail, trail_completed_now, added_concepts, upgraded_concepts)``.
        ``trail_completed_now`` só é ``True`` na transição 0% → 100%; nas
        outras chamadas vem ``False`` e as listas vêm vazias.
        """
        trail = self.get_for_user(user, trail_id)
        content = self._parse_content(trail)

        # Acha o ticket pelo code.
        target_index = next(
            (i for i, t in enumerate(content.tickets) if t.code == ticket_code),
            None,
        )
        if target_index is None:
            raise NotFoundError(f"Ticket '{ticket_code}' não existe nesta trilha")

        target = content.tickets[target_index]
        already_marked = target.completed_at is not None
        if completed and already_marked:
            # Idempotente: já estava marcado, nada a fazer.
            return trail, False, [], []
        if not completed and not already_marked:
            return trail, False, [], []

        new_timestamp = datetime.now(timezone.utc) if completed else None
        updated_tickets = [
            t.model_copy(update={"completed_at": new_timestamp}) if i == target_index else t
            for i, t in enumerate(content.tickets)
        ]
        content = content.model_copy(update={"tickets": updated_tickets})

        # Detecta auto-conclusão da trilha (transição 0% → 100%).
        all_done = all(t.completed_at is not None for t in updated_tickets)
        trail_completed_now = False
        added: list[str] = []
        upgraded: list[str] = []

        if completed and all_done and trail.completed_at is None:
            # Aplica as categorias genéricas (backfill se necessário) +
            # marca a trilha como concluída.
            categories = list(content.skill_categories)
            if not categories:
                raw_concepts: list[str] = []
                for t in updated_tickets:
                    raw_concepts.extend(t.concepts)
                categories = self.ai_provider.categorize_concepts(raw_concepts)
                content = content.model_copy(update={"skill_categories": categories})
            added, upgraded = self.skill_service.apply_concepts(
                user, categories, target_level=2
            )
            trail.completed_at = new_timestamp
            trail_completed_now = True
        elif not completed and trail.completed_at is not None:
            # "Desconclui" a trilha: ao desmarcar um ticket, a trilha não
            # pode mais ser considerada finalizada. Skills aplicadas ficam.
            trail.completed_at = None

        trail.content_json = content.model_dump_json()
        self.repository.update(trail)
        return trail, trail_completed_now, added, upgraded

    # ------------------------------------------------------------------ #
    # Helpers privados
    # ------------------------------------------------------------------ #
    def _with_skill_categories(self, content: TrailContent) -> TrailContent:
        """Roda o categorizador sobre os concepts da trilha e injeta o resultado.

        Se o provider falhar, repassa o erro — o aluno não pode ter trilha
        sem skill_categories no contrato. Isolar a falha aqui evita estado
        meio-pronto persistido.
        """
        raw_concepts: list[str] = []
        for ticket in content.tickets:
            raw_concepts.extend(ticket.concepts)
        categories = self.ai_provider.categorize_concepts(raw_concepts)
        return content.model_copy(update={"skill_categories": categories})

    def explain_concept_for_user(
        self,
        user: User,
        trail_id: int,
        ticket_code: str,
        concept: str,
        *,
        force_refresh: bool = False,
    ) -> ConceptExplanation:
        trail = self.get_for_user(user, trail_id)
        content = self._parse_content(trail)
        ticket = next(
            (t for t in content.tickets if t.code.lower() == ticket_code.lower()),
            None,
        )
        if ticket is None:
            raise NotFoundError(f"Ticket {ticket_code} não encontrado nesta trilha")
        if concept not in ticket.concepts:
            raise NotFoundError(
                f"Conceito '{concept}' não pertence ao ticket {ticket_code}"
            )

        if not force_refresh:
            cached = self.concept_cache.get(
                trail_id=trail.id, ticket_code=ticket.code, concept=concept
            )
            if cached is not None:
                try:
                    return ConceptExplanation.model_validate_json(cached.payload_json)
                except ValidationError:
                    # Cache corrompido (mudança de schema, etc.): regenera.
                    pass

        explanation = self.ai_provider.explain_concept(
            concept,
            context=ConceptContext(
                project_title=content.project_title,
                ticket_title=ticket.title,
                ticket_objective=ticket.objective,
            ),
            skills=_to_skill_inputs(user),
        )
        self.concept_cache.upsert(
            trail_id=trail.id,
            ticket_code=ticket.code,
            concept=concept,
            payload_json=explanation.model_dump_json(),
        )
        return explanation

    # ------------------------------------------------------------------ #
    # Serialization
    # ------------------------------------------------------------------ #
    @staticmethod
    def to_read_model(trail: LearningTrail) -> LearningTrailRead:
        content = LearningTrailService._parse_content(trail)
        return LearningTrailRead(
            id=trail.id,
            topic=trail.topic,
            title=trail.title,
            summary=trail.summary,
            content=content,
            completed_at=trail.completed_at,
            created_at=trail.created_at,
            updated_at=trail.updated_at,
        )

    @staticmethod
    def to_list_item(trail: LearningTrail) -> LearningTrailListItem:
        """Converte para o schema enxuto já com contagem de tickets.

        Parseia o ``content_json`` só para extrair as contagens — vale a
        ida ao JSON pra não forar a UI a um round-trip por trilha.
        """
        try:
            content = TrailContent.model_validate_json(trail.content_json)
            tickets = content.tickets
            total = len(tickets)
            done = sum(1 for t in tickets if t.completed_at is not None)
        except ValidationError:
            total = 0
            done = 0
        return LearningTrailListItem(
            id=trail.id,
            topic=trail.topic,
            title=trail.title,
            summary=trail.summary,
            completed_at=trail.completed_at,
            ticket_count=total,
            completed_ticket_count=done,
            created_at=trail.created_at,
            updated_at=trail.updated_at,
        )

    @staticmethod
    def _parse_content(trail: LearningTrail) -> TrailContent:
        try:
            return TrailContent.model_validate_json(trail.content_json)
        except ValidationError as exc:
            raise DomainValidationError(
                "Conteúdo da trilha está corrompido",
                details={"trail_id": trail.id},
            ) from exc


def _serialize_assessment(assessment: Sequence[TopicAnswer]) -> str | None:
    if not assessment:
        return None
    return json.dumps([a.model_dump() for a in assessment], ensure_ascii=False)


def _deserialize_assessment(raw: str | None) -> list[TopicAnswer]:
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    try:
        return _ASSESSMENT_LIST_ADAPTER.validate_python(data)
    except ValidationError:
        return []


def _serialize_topic_input(topic: str) -> str:
    return json.dumps(
        {"mode": TrailCreationMode.TOPIC.value, "topic": topic.strip()},
        ensure_ascii=False,
    )


def _serialize_project_input(project_scope: str, technologies: Sequence[str]) -> str:
    return json.dumps(
        {
            "mode": TrailCreationMode.PROJECT.value,
            "project_scope": project_scope.strip(),
            "technologies": [t.strip() for t in technologies if t and t.strip()],
        },
        ensure_ascii=False,
    )


def _deserialize_creation_input(raw: str | None) -> dict | None:
    """Lê o snapshot do payload de criação. Tolerante a JSON inválido —
    trilhas antigas (campo nulo) caem no fallback de modo TOPIC.
    """
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    return data
