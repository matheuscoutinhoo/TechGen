"""Cache persistido de explicações de conceito geradas pela IA.

Chave de unicidade: ``(trail_id, ticket_code, concept_key)``. ``concept_key``
é o conceito normalizado em lowercase para evitar duplicatas por capitalização.

Cascade na trilha garante limpeza automática em delete; na regeneração da
trilha, o service apaga as entradas associadas para forçar recomputação na
próxima leitura.
"""
from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ConceptExplanationCache(Base, TimestampMixin):
    __tablename__ = "concept_explanation_cache"
    __table_args__ = (
        UniqueConstraint(
            "trail_id",
            "ticket_code",
            "concept_key",
            name="uq_concept_cache_trail_ticket_concept",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    trail_id: Mapped[int] = mapped_column(
        ForeignKey("learning_trails.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ticket_code: Mapped[str] = mapped_column(String(20), nullable=False)
    concept_key: Mapped[str] = mapped_column(String(200), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
