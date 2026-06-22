"""Service de credenciais de IA do usuário (BYOK).

Responsável por cifrar a API key na escrita, mascará-la na leitura e montar o
``AIProvider`` específico do usuário a partir da credencial decifrada. A chave
em texto puro só existe em memória, no instante exato da operação.
"""
from __future__ import annotations

import logging

from app.core.crypto import decrypt_secret, encrypt_secret, mask_secret
from app.exceptions import NotFoundError
from app.models.ai_credential import AICredential
from app.models.user import User
from app.repositories.ai_credential_repository import AICredentialRepository
from app.schemas.ai_credential import AICredentialStatus, AICredentialUpsert
from app.services.ai.base import AIProvider

logger = logging.getLogger(__name__)


class AICredentialService:
    def __init__(self, repository: AICredentialRepository) -> None:
        self.repository = repository

    def get_status(self, user: User) -> AICredentialStatus:
        """Estado da credencial do usuário, seguro para serializar."""
        credential = self.repository.get_by_user(user.id)
        if credential is None:
            return AICredentialStatus.not_configured()
        return self._to_status(credential)

    def upsert(self, user: User, payload: AICredentialUpsert) -> AICredentialStatus:
        """Cria ou substitui a credencial, cifrando a chave antes de persistir."""
        encrypted = encrypt_secret(payload.api_key)
        credential = self.repository.upsert(
            user_id=user.id,
            provider=payload.provider,
            encrypted_api_key=encrypted,
            model=payload.model,
            base_url=payload.base_url,
        )
        # Nunca logar a chave; apenas o fato e o provider.
        logger.info(
            "Credencial de IA atualizada (user_id=%s, provider=%s)",
            user.id,
            payload.provider,
        )
        return self._to_status(credential)

    def delete(self, user: User) -> None:
        """Remove a credencial do usuário. 404 se não houver nada para remover."""
        credential = self.repository.get_by_user(user.id)
        if credential is None:
            raise NotFoundError("Nenhuma credencial de IA configurada.")
        self.repository.delete(credential)
        logger.info("Credencial de IA removida (user_id=%s)", user.id)

    def build_provider(self, user: User) -> AIProvider | None:
        """Monta o ``AIProvider`` do usuário a partir da credencial decifrada.

        Retorna ``None`` quando o usuário não tem credencial — o chamador então
        cai no provider global configurado por ambiente, preservando o
        comportamento de quem não usa BYOK.
        """
        credential = self.repository.get_by_user(user.id)
        if credential is None:
            return None
        # Import tardio evita ciclo (factory → providers → schemas).
        from app.services.ai.factory import build_provider_for_credential

        api_key = decrypt_secret(credential.encrypted_api_key)
        return build_provider_for_credential(
            provider=credential.provider,
            api_key=api_key,
            model=credential.model,
            base_url=credential.base_url,
        )

    def _to_status(self, credential: AICredential) -> AICredentialStatus:
        try:
            masked = mask_secret(decrypt_secret(credential.encrypted_api_key))
        except ValueError:
            # Chave cifrada com outra ENCRYPTION_KEY/SECRET_KEY: não dá pra
            # mascarar o valor real, mas a credencial existe.
            masked = "••••"
        return AICredentialStatus(
            configured=True,
            provider=credential.provider,  # type: ignore[arg-type]
            model=credential.model,
            base_url=credential.base_url,
            key_masked=masked,
            updated_at=credential.updated_at,
        )
