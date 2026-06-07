"""Service de Skills (tecnologias/conceitos do aluno)."""
from __future__ import annotations

from typing import Sequence

from app.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.skill import PROFICIENCY_LEVELS, Skill
from app.models.user import User
from app.repositories.skill_repository import SkillRepository


class SkillService:
    def __init__(self, skill_repository: SkillRepository) -> None:
        self.repository = skill_repository

    # ------------------------------------------------------------------ #
    # CRUD
    # ------------------------------------------------------------------ #
    def list_for_user(self, user: User) -> Sequence[Skill]:
        return self.repository.list_by_user(user.id)

    def get_for_user(self, user: User, skill_id: int) -> Skill:
        skill = self.repository.get(skill_id)
        if skill is None:
            raise NotFoundError("Skill não encontrada")
        if skill.user_id != user.id:
            raise ForbiddenError("Você não tem acesso a esta skill")
        return skill

    def add_for_user(
        self,
        user: User,
        *,
        name: str,
        proficiency: int,
    ) -> Skill:
        normalized = name.strip()
        if not normalized:
            raise ConflictError("Nome da skill é obrigatório")
        self._validate_level(proficiency)
        if self.repository.get_by_name(user.id, normalized):
            raise ConflictError(f"Você já cadastrou a skill '{normalized}'")
        return self.repository.create(
            user_id=user.id, name=normalized, proficiency=proficiency
        )

    def update_for_user(
        self,
        user: User,
        skill_id: int,
        *,
        proficiency: int,
    ) -> Skill:
        skill = self.get_for_user(user, skill_id)
        self._validate_level(proficiency)
        skill.proficiency = proficiency
        return self.repository.update(skill)

    def delete_for_user(self, user: User, skill_id: int) -> None:
        skill = self.get_for_user(user, skill_id)
        self.repository.delete(skill)

    # ------------------------------------------------------------------ #
    # Progressão
    # ------------------------------------------------------------------ #
    def apply_concepts(
        self,
        user: User,
        concepts: Sequence[str],
        *,
        target_level: int = 2,
    ) -> tuple[list[str], list[str]]:
        """Adiciona/atualiza skills a partir de uma lista de conceitos.

        Retorna ``(added, upgraded)`` com os nomes normalizados afetados.
        Skills inexistentes são criadas em ``target_level``; existentes com
        proficiência menor são elevadas para ``target_level``.
        """
        self._validate_level(target_level)
        added: list[str] = []
        upgraded: list[str] = []
        seen: set[str] = set()
        for raw in concepts:
            name = (raw or "").strip()
            if not name:
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            existing = self.repository.get_by_name(user.id, name)
            if existing is None:
                self.repository.create(
                    user_id=user.id, name=name, proficiency=target_level
                )
                added.append(key)
            elif existing.proficiency < target_level:
                existing.proficiency = target_level
                self.repository.update(existing)
                upgraded.append(key)
        return added, upgraded

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _validate_level(proficiency: int) -> None:
        if proficiency not in PROFICIENCY_LEVELS:
            raise ConflictError(
                f"Proficiência inválida (use {sorted(PROFICIENCY_LEVELS)})"
            )
