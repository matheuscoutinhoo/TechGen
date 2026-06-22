"""Modelo de credencial de IA do usuário (BYOK — Bring Your Own Key).

Cada usuário pode trazer a própria API key de IA. A chave é cifrada em repouso
(ver ``app/core/crypto.py``) e só é decifrada no instante de montar o provider
para aquele usuário. Uma credencial ativa por usuário (one-to-one): trocar de
provider é sobrescrever a credencial existente.
"""
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

# Providers suportados no modo BYOK. Ambos falam o contrato Chat Completions
# (POST /v1/chat/completions, Bearer auth); o discriminante define base URL e
# os defaults de modelo. Manter como tupla simples — fonte de verdade única
# consumida por schema, service e factory.
AI_PROVIDER_KINDS = ("abacus", "openai")


class AICredential(Base, TimestampMixin):
    __tablename__ = "ai_credentials"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Uma credencial por usuário (unique). O usuário escolhe UM provider de cada
    # vez; cascade em delete remove a credencial junto com a conta.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(32), nullable=False)
    # API key cifrada com Fernet. NUNCA em texto puro. ``Text`` porque o token
    # cifrado (base64) é maior que a chave original.
    encrypted_api_key: Mapped[str] = mapped_column(Text, nullable=False)
    # Modelo e base URL opcionais; quando ausentes usamos os defaults do
    # provider escolhido. Tipos portáveis (String) para SQLite e Postgres.
    model: Mapped[str | None] = mapped_column(String(120), nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    owner: Mapped["User"] = relationship(  # noqa: F821
        back_populates="ai_credential"
    )
