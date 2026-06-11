"""Repository de trilhas de aprendizado."""
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.learning_trail import LearningTrail


class LearningTrailRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> Sequence[LearningTrail]:
        stmt = (
            select(LearningTrail)
            .where(LearningTrail.user_id == user_id)
            .order_by(LearningTrail.created_at.desc())
        )
        return self.db.execute(stmt).scalars().all()

    def get(self, trail_id: int) -> Optional[LearningTrail]:
        return self.db.get(LearningTrail, trail_id)

    def create(
        self,
        *,
        user_id: int,
        topic: str,
        title: str,
        summary: str,
        content_json: str,
        assessment_json: str | None = None,
        creation_input_json: str | None = None,
    ) -> LearningTrail:
        trail = LearningTrail(
            user_id=user_id,
            topic=topic,
            title=title,
            summary=summary,
            content_json=content_json,
            assessment_json=assessment_json,
            creation_input_json=creation_input_json,
        )
        self.db.add(trail)
        self.db.commit()
        self.db.refresh(trail)
        return trail

    def update(self, trail: LearningTrail) -> LearningTrail:
        self.db.add(trail)
        self.db.commit()
        self.db.refresh(trail)
        return trail

    def delete(self, trail: LearningTrail) -> None:
        self.db.delete(trail)
        self.db.commit()
