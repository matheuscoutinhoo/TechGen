"""Schemas Pydantic para Skills (tecnologias/conceitos do usuário)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.skill import PROFICIENCY_LABELS, PROFICIENCY_LEVELS

ProficiencyLevel = Literal[1, 2, 3, 4]
ProficiencyLabel = Literal["novice", "beginner", "intermediate", "advanced"]


class SkillBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    proficiency: ProficiencyLevel = 1

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Nome da skill é obrigatório")
        return cleaned


class SkillCreate(SkillBase):
    pass


class SkillUpdate(BaseModel):
    proficiency: ProficiencyLevel


class SkillRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    proficiency: ProficiencyLevel
    proficiency_label: ProficiencyLabel
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_model(cls, model) -> "SkillRead":
        level: ProficiencyLevel = model.proficiency if model.proficiency in PROFICIENCY_LEVELS else 1
        return cls(
            id=model.id,
            name=model.name,
            proficiency=level,
            proficiency_label=PROFICIENCY_LABELS[level],  # type: ignore[arg-type]
            created_at=model.created_at,
            updated_at=model.updated_at,
        )
