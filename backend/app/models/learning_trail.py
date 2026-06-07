"""Modelo de trilha de aprendizado.

Armazena ``content`` como JSON serializado em texto para manter portabilidade
total entre SQLite (sem tipo JSON nativo robusto) e PostgreSQL. O parsing é
feito na camada de service via schemas Pydantic.

``completed_at`` registra quando o aluno marcou a trilha como concluída — a
transição também aciona o sistema de progressão de skills.
"""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class LearningTrail(Base, TimestampMixin):
    __tablename__ = "learning_trails"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    topic: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    content_json: Mapped[str] = mapped_column(Text, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    owner: Mapped["User"] = relationship(back_populates="trails")  # noqa: F821
