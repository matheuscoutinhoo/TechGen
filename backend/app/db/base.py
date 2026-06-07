"""Base declarativa do SQLAlchemy 2.x."""
from datetime import datetime, timezone

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base comum a todos os modelos."""


class TimestampMixin:
    """Mixin que adiciona created_at/updated_at em UTC.

    Usa ``DateTime(timezone=True)``: em PostgreSQL é nativo; em SQLite o SQLAlchemy
    traduz e mantém o valor em UTC, evitando acoplamento ao banco.
    """

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
