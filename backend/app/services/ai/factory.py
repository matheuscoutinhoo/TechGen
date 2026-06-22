"""Factory do AIProvider.

Dois caminhos:

* :func:`get_ai_provider` — provider GLOBAL configurado por ambiente. É o
  fallback usado quando o usuário não trouxe a própria chave (BYOK). Cacheado.
* :func:`build_provider_for_credential` — monta o provider a partir da
  credencial decifrada de um usuário específico. NUNCA cacheado (lida com
  segredo por requisição) e agnóstico quanto ao provider (Abacus ou OpenAI,
  que falam o mesmo contrato Chat Completions).
"""
from functools import lru_cache

from app.core.config import get_settings
from app.exceptions import AIProviderError
from app.services.ai.abacus_provider import AbacusAIProvider
from app.services.ai.base import AIProvider
from app.services.ai.fake_provider import FakeAIProvider
from app.services.ai.openai_provider import OpenAIAIProvider


@lru_cache
def get_ai_provider() -> AIProvider:
    settings = get_settings()
    if settings.ai_provider == "abacus":
        return AbacusAIProvider(
            api_url=settings.abacus_api_url,
            api_key=settings.abacus_api_key,
            model=settings.abacus_model,
            questions_model=settings.abacus_questions_model or None,
            concept_model=settings.abacus_concept_model or None,
            categorizer_model=settings.abacus_categorizer_model or None,
            timeout_seconds=settings.abacus_timeout_seconds,
        )
    if settings.ai_provider == "openai":
        return OpenAIAIProvider(
            api_url=settings.openai_api_url,
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            timeout_seconds=settings.openai_timeout_seconds,
        )
    return FakeAIProvider()


def build_provider_for_credential(
    *,
    provider: str,
    api_key: str,
    model: str | None = None,
    base_url: str | None = None,
) -> AIProvider:
    """Monta o ``AIProvider`` de um usuário a partir da sua credencial BYOK.

    Modelo e base URL omitidos caem nos defaults do provider escolhido (lidos
    das settings). Para a Abacus, reaproveitamos os modelos auxiliares
    (perguntas/conceito/categorizador) configurados globalmente — são apenas
    nomes de modelo, não segredos.
    """
    settings = get_settings()
    if provider == "openai":
        return OpenAIAIProvider(
            api_url=base_url or settings.openai_api_url,
            api_key=api_key,
            model=model or settings.openai_model,
            timeout_seconds=settings.openai_timeout_seconds,
        )
    if provider == "abacus":
        return AbacusAIProvider(
            api_url=base_url or settings.abacus_api_url,
            api_key=api_key,
            model=model or settings.abacus_model,
            questions_model=settings.abacus_questions_model or None,
            concept_model=settings.abacus_concept_model or None,
            categorizer_model=settings.abacus_categorizer_model or None,
            timeout_seconds=settings.abacus_timeout_seconds,
        )
    raise AIProviderError(f"Provider de IA desconhecido: {provider}")

