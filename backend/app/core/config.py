"""Configurações globais carregadas a partir de variáveis de ambiente."""
from functools import lru_cache
from typing import Annotated, List, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_name: str = "MentorIA API"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"

    # Banco
    database_url: str = "sqlite:///./techgen.db"

    # Segurança
    secret_key: str = Field(default="dev-secret-change-me", min_length=16)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    # Chave de criptografia simétrica para segredos do usuário (BYOK: API keys
    # de IA cifradas em repouso). Quando vazia, é derivada de ``secret_key``.
    # Em produção, defina uma ``ENCRYPTION_KEY`` dedicada e estável — rotacionar
    # a fonte invalida as chaves já gravadas.
    encryption_key: str = ""

    # CORS — ``NoDecode`` impede o pydantic-settings 2.10+ de tentar JSON-parse
    # do valor cru; o validator abaixo cuida do split CSV.
    allowed_origins: Annotated[List[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    # IA — provider GLOBAL (fallback usado quando o usuário não trouxe a
    # própria chave via BYOK). Cada usuário pode sobrepor isto com a sua
    # credencial em ``/api/v1/ai-credentials``.
    ai_provider: Literal["abacus", "openai", "fake"] = "fake"
    abacus_api_url: str = "https://routellm.abacus.ai"
    abacus_api_key: str = ""
    abacus_model: str = "gpt-5"
    # Modelo usado nas perguntas de diagnóstico (curtas, baratas). Fallback no
    # ``abacus_model`` quando vazio.
    abacus_questions_model: str = ""
    # Modelo dedicado às explicações de conceito. A explicação é um payload
    # estruturado e limitado (bem menor que uma trilha inteira), então um
    # modelo da classe Sonnet entrega a mesma qualidade pedagógica com
    # latência bem menor que o ``abacus_model`` top-tier. Fallback no
    # ``abacus_model`` quando vazio.
    abacus_concept_model: str = "claude-sonnet-4-6"
    # Modelo usado para abstrair os concepts dos tickets em poucas skills
    # genéricas (chamada barata, output pequeno). Fallback no ``abacus_model``
    # quando vazio.
    abacus_categorizer_model: str = "claude-haiku-4-5-20251001"
    abacus_timeout_seconds: int = 300

    # OpenAI — provider GLOBAL alternativo (e defaults do modo BYOK quando o
    # usuário escolhe "openai" sem especificar modelo/URL). A OpenAI fala o
    # mesmo contrato Chat Completions da Abacus, então reaproveitamos o provider.
    openai_api_url: str = "https://api.openai.com"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_timeout_seconds: int = 300

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def _split_origins(cls, value):
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
