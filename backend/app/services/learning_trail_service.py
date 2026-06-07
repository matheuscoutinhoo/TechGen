"""Service de trilhas de aprendizado."""
from __future__ import annotations

from typing import Sequence

from pydantic import ValidationError

from app.exceptions import ForbiddenError, NotFoundError
from app.exceptions import ValidationError as DomainValidationError
from app.models.learning_trail import LearningTrail
from app.models.user import User
from app.repositories.learning_trail_repository import LearningTrailRepository
from app.schemas.learning_trail import LearningTrailRead, TrailContent
from app.services.ai.base import AIProvider


class LearningTrailService:
    def __init__(
        self,
        *,
        repository: LearningTrailRepository,
        ai_provider: AIProvider,
    ) -> None:
        self.repository = repository
        self.ai_provider = ai_provider

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

    # ------------------------------------------------------------------ #
    # Commands
    # ------------------------------------------------------------------ #
    def create_for_user(self, user: User, *, topic: str) -> LearningTrail:
        content = self.ai_provider.generate_learning_trail(topic)
        return self.repository.create(
            user_id=user.id,
            topic=topic.strip(),
            title=content.project_title,
            summary=content.project_summary,
            content_json=content.model_dump_json(),
        )

    def regenerate_for_user(self, user: User, trail_id: int) -> LearningTrail:
        trail = self.get_for_user(user, trail_id)
        content = self.ai_provider.generate_learning_trail(trail.topic)
        trail.title = content.project_title
        trail.summary = content.project_summary
        trail.content_json = content.model_dump_json()
        return self.repository.update(trail)

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
            # mantém title/summary sincronizados com o conteúdo se não vieram explícitos
            if title is None:
                trail.title = content.project_title
            if summary is None:
                trail.summary = content.project_summary
        return self.repository.update(trail)

    def delete_for_user(self, user: User, trail_id: int) -> None:
        trail = self.get_for_user(user, trail_id)
        self.repository.delete(trail)

    # ------------------------------------------------------------------ #
    # Serialization
    # ------------------------------------------------------------------ #
    @staticmethod
    def to_read_model(trail: LearningTrail) -> LearningTrailRead:
        try:
            content = TrailContent.model_validate_json(trail.content_json)
        except ValidationError as exc:
            raise DomainValidationError(
                "Conteúdo da trilha está corrompido",
                details={"trail_id": trail.id},
            ) from exc
        return LearningTrailRead(
            id=trail.id,
            topic=trail.topic,
            title=trail.title,
            summary=trail.summary,
            content=content,
            created_at=trail.created_at,
            updated_at=trail.updated_at,
        )
