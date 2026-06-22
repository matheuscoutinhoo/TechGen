"""Schemas Pydantic para credenciais de IA do usuário (BYOK).

Princípio de segurança: a API key entra apenas via ``AICredentialUpsert`` (write)
e NUNCA volta em texto puro. ``AICredentialStatus`` (read) expõe somente metadados
e uma versão mascarada da chave (últimos 4 caracteres) como prova de existência.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models.ai_credential import AI_PROVIDER_KINDS

AIProviderKind = Literal["abacus", "openai"]


class AICredentialUpsert(BaseModel):
    """Payload de criação/atualização da credencial (idempotente por usuário)."""

    provider: AIProviderKind
    # A chave em si — único ponto de entrada do segredo. Cifrada no service
    # antes de tocar o banco.
    api_key: str = Field(min_length=8, max_length=512)
    # Modelo e base URL opcionais; quando ausentes, o provider usa os defaults.
    model: str | None = Field(default=None, max_length=120)
    base_url: str | None = Field(default=None, max_length=255)

    @field_validator("provider")
    @classmethod
    def _check_provider(cls, value: str) -> str:
        if value not in AI_PROVIDER_KINDS:
            raise ValueError(
                f"Provider inválido. Use um de: {', '.join(AI_PROVIDER_KINDS)}."
            )
        return value

    @field_validator("api_key")
    @classmethod
    def _strip_api_key(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 8:
            raise ValueError("API key muito curta.")
        return cleaned

    @field_validator("model")
    @classmethod
    def _normalize_model(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("base_url")
    @classmethod
    def _normalize_base_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if not cleaned.startswith(("http://", "https://")):
            raise ValueError("base_url deve começar com http:// ou https://.")
        return cleaned


class AICredentialStatus(BaseModel):
    """Estado da credencial do usuário, seguro para serializar para o cliente."""

    configured: bool
    provider: AIProviderKind | None = None
    model: str | None = None
    base_url: str | None = None
    # Apenas os últimos caracteres da chave (ex.: ``••••a1b2``). Nunca a chave.
    key_masked: str | None = None
    updated_at: datetime | None = None

    @classmethod
    def not_configured(cls) -> "AICredentialStatus":
        return cls(configured=False)
