"""Repository de credenciais de IA do usuário (BYOK)."""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_credential import AICredential


class AICredentialRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_user(self, user_id: int) -> Optional[AICredential]:
        stmt = select(AICredential).where(AICredential.user_id == user_id)
        return self.db.execute(stmt).scalar_one_or_none()

    def upsert(
        self,
        *,
        user_id: int,
        provider: str,
        encrypted_api_key: str,
        model: str | None,
        base_url: str | None,
    ) -> AICredential:
        """Cria ou substitui a credencial do usuário (uma por usuário)."""
        existing = self.get_by_user(user_id)
        if existing is None:
            existing = AICredential(user_id=user_id)
            self.db.add(existing)
        existing.provider = provider
        existing.encrypted_api_key = encrypted_api_key
        existing.model = model
        existing.base_url = base_url
        self.db.commit()
        self.db.refresh(existing)
        return existing

    def delete(self, credential: AICredential) -> None:
        self.db.delete(credential)
        self.db.commit()
