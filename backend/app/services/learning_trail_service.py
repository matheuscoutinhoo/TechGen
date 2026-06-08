"""Service de trilhas de aprendizado."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Sequence

from pydantic import TypeAdapter, ValidationError

from app.exceptions import ConflictError, ForbiddenError, NotFoundError
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
    LearningTrailRead,
    TopicAnswer,
    TopicQuestionSet,
    TrailContent,
)
from app.services.ai.base import AIProvider, ConceptContext, UserSkillInput
from app.services.skill_service import SkillService


_ASSESSMENT_LIST_ADAPTER = TypeAdapter(list[TopicAnswer])


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

    def build_assessment_for_user(self, user: User, *, topic: str) -> TopicQuestionSet:
        """Pede à IA o conjunto de perguntas de diagnóstico para o tema."""
        return self.ai_provider.generate_topic_questions(
            topic, skills=_to_skill_inputs(user)
        )

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
        return self.repository.create(
            user_id=user.id,
            topic=topic.strip(),
            title=content.project_title,
            summary=content.project_summary,
            content_json=content.model_dump_json(),
            assessment_json=_serialize_assessment(assessment),
        )

    def regenerate_for_user(self, user: User, trail_id: int) -> LearningTrail:
        trail = self.get_for_user(user, trail_id)
        stored = _deserialize_assessment(trail.assessment_json)
        content = self.ai_provider.generate_learning_trail(
            trail.topic,
            skills=_to_skill_inputs(user),
            assessment=stored,
        )
        trail.title = content.project_title
        trail.summary = content.project_summary
        trail.content_json = content.model_dump_json()
        trail.completed_at = None
        updated = self.repository.update(trail)
        # Conteúdo da trilha mudou: as explicações antigas perderam contexto.
        self.concept_cache.delete_for_trail(trail.id)
        return updated

    def update_for_user(
        self,
        user: User,
        trail_id: int,
        *,
        title: str | None = None,
        summary: str | None = None,
        content: TrailContent | None = None,
    ) -> LearningTrail:
        trail = self.get_for_user(user, trail_id)
        if title is not None:
            trail.title = title
        if summary is not None:
            trail.summary = summary
        if content is not None:
            trail.content_json = content.model_dump_json()
            if title is None:
                trail.title = content.project_title
            if summary is None:
                trail.summary = content.project_summary
            # Edição manual do conteúdo também invalida o cache.
            self.concept_cache.delete_for_trail(trail.id)
        return self.repository.update(trail)

    def delete_for_user(self, user: User, trail_id: int) -> None:
        trail = self.get_for_user(user, trail_id)
        self.repository.delete(trail)

    # ------------------------------------------------------------------ #
    # Conclusão + progressão de skills
    # ------------------------------------------------------------------ #
    def complete_for_user(
        self, user: User, trail_id: int
    ) -> tuple[LearningTrail, list[str], list[str]]:
        trail = self.get_for_user(user, trail_id)
        if trail.completed_at is not None:
            raise ConflictError("Trilha já marcada como concluída")
        content = self._parse_content(trail)
        all_concepts: list[str] = []
        for ticket in content.tickets:
            all_concepts.extend(ticket.concepts)
        added, upgraded = self.skill_service.apply_concepts(
            user, all_concepts, target_level=2
        )
        trail.completed_at = datetime.now(timezone.utc)
        self.repository.update(trail)
        return trail, added, upgraded

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
