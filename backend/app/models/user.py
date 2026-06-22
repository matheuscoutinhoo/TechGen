"""Modelo de usuário."""
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    # Foto de perfil armazenada como data URL base64 (data:image/...).
    # Limite de tamanho aplicado no schema/serviço; nullable porque o user
    # pode optar por não enviar foto.
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    trails: Mapped[list["LearningTrail"]] = relationship(  # noqa: F821
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    skills: Mapped[list["Skill"]] = relationship(  # noqa: F821
        back_populates="owner",
        cascade="all, delete-orphan",
    )
    # Credencial de IA própria do usuário (BYOK). One-to-one e opcional: quando
    # ausente, o sistema cai no provider global configurado por ambiente.
    ai_credential: Mapped["AICredential | None"] = relationship(  # noqa: F821
        back_populates="owner",
        cascade="all, delete-orphan",
        uselist=False,
    )
