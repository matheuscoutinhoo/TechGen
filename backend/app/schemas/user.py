"""Schemas Pydantic relacionados a usuário."""
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.skill import SkillCreate


# Limite de tamanho do avatar em base64 (~600KB de string = imagem ~450KB).
# Suficiente pra um avatar quadrado redimensionado a 256x256 com qualidade
# decente em PNG/JPEG. Acima disso o frontend deve redimensionar antes.
AVATAR_DATA_URL_MAX_LENGTH = 600_000
AVATAR_ALLOWED_PREFIXES = (
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/jpg;base64,",
    "data:image/webp;base64,",
    "data:image/gif;base64,",
)


def _validate_avatar(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    if len(value) > AVATAR_DATA_URL_MAX_LENGTH:
        raise ValueError("Imagem muito grande. Use uma foto menor que ~450KB.")
    if not value.startswith(AVATAR_ALLOWED_PREFIXES):
        raise ValueError("Formato de imagem inválido. Use PNG, JPEG, WebP ou GIF.")
    return value


class UserBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    # Skills opcionais informadas no momento do cadastro; o backend valida e
    # persiste no mesmo fluxo de registro, garantindo personalização desde a
    # primeira trilha.
    skills: list[SkillCreate] = Field(default_factory=list, max_length=30)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    # Foto de perfil opcional como data URL. Enviar string vazia ou null
    # explícito remove a foto atual; omitir o campo mantém a existente.
    avatar_url: str | None = Field(default=None, max_length=AVATAR_DATA_URL_MAX_LENGTH)

    @field_validator("avatar_url")
    @classmethod
    def _check_avatar(cls, value: str | None) -> str | None:
        return _validate_avatar(value)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    avatar_url: str | None = None
    created_at: datetime
    updated_at: datetime
