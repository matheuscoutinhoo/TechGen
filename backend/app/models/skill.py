"""Modelo de skill (tecnologia/conceito) com nível de proficiência.

Skills servem a dois propósitos:
1. Personalização: ao gerar uma trilha, o AIProvider recebe as skills do
   aluno e calibra o nivelamento (não explicar do zero o que ele já domina,
   aprofundar o que ele só conhece superficialmente).
2. Progressão: ao concluir uma trilha, os conceitos cobertos viram skills
   (ou têm seu nível elevado) no perfil do aluno.
"""
from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

# Níveis válidos. Inteiro armazenado no banco para ordenação e comparação
# triviais; conversão para rótulo legível é feita na camada de schema.
PROFICIENCY_LEVELS = (1, 2, 3, 4)
PROFICIENCY_LABELS = {
    1: "novice",        # ouvi falar
    2: "beginner",      # já mexi algumas vezes
    3: "intermediate",  # uso confortavelmente
    4: "advanced",      # ensino ou domino o tópico
}


class Skill(Base, TimestampMixin):
    __tablename__ = "skills"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_skills_user_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Nome normalizado em lowercase no service para a constraint funcionar.
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    proficiency: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    owner: Mapped["User"] = relationship(back_populates="skills")  # noqa: F821
