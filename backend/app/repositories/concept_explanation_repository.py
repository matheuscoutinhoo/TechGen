"""Repository do cache de explicações de conceito."""
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.concept_explanation_cache import ConceptExplanationCache


def _normalize(value: str) -> str:
    return value.strip().lower()


class ConceptExplanationRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get(
        self,
        *,
        trail_id: int,
        ticket_code: str,
        concept: str,
    ) -> Optional[ConceptExplanationCache]:
        stmt = select(ConceptExplanationCache).where(
            ConceptExplanationCache.trail_id == trail_id,
            ConceptExplanationCache.ticket_code == ticket_code,
            ConceptExplanationCache.concept_key == _normalize(concept),
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def upsert(
        self,
        *,
        trail_id: int,
        ticket_code: str,
        concept: str,
        payload_json: str,
    ) -> ConceptExplanationCache:
        existing = self.get(
            trail_id=trail_id, ticket_code=ticket_code, concept=concept
        )
        if existing is not None:
            existing.payload_json = payload_json
            self.db.add(existing)
            self.db.commit()
            self.db.refresh(existing)
            return existing
        cached = ConceptExplanationCache(
            trail_id=trail_id,
            ticket_code=ticket_code,
            concept_key=_normalize(concept),
            payload_json=payload_json,
        )
        self.db.add(cached)
        self.db.commit()
        self.db.refresh(cached)
        return cached

    def delete_for_trail(self, trail_id: int) -> int:
        """Apaga todas as entradas de uma trilha. Retorna a contagem."""
        result = self.db.execute(
            delete(ConceptExplanationCache).where(
                ConceptExplanationCache.trail_id == trail_id
            )
        )
        self.db.commit()
        return result.rowcount or 0
