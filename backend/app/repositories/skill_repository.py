"""Repository de skills do usuário."""
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.skill import Skill


class SkillRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list_by_user(self, user_id: int) -> Sequence[Skill]:
        stmt = (
            select(Skill)
            .where(Skill.user_id == user_id)
            .order_by(Skill.proficiency.desc(), Skill.name.asc())
        )
        return self.db.execute(stmt).scalars().all()

    def get(self, skill_id: int) -> Optional[Skill]:
        return self.db.get(Skill, skill_id)

    def get_by_name(self, user_id: int, name: str) -> Optional[Skill]:
        stmt = select(Skill).where(
            Skill.user_id == user_id, Skill.name == name.lower()
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def create(self, *, user_id: int, name: str, proficiency: int) -> Skill:
        skill = Skill(user_id=user_id, name=name.lower(), proficiency=proficiency)
        self.db.add(skill)
        self.db.commit()
        self.db.refresh(skill)
        return skill

    def update(self, skill: Skill) -> Skill:
        self.db.add(skill)
        self.db.commit()
        self.db.refresh(skill)
        return skill

    def delete(self, skill: Skill) -> None:
        self.db.delete(skill)
        self.db.commit()
