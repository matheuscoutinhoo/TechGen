"""Factory do AIProvider conforme configuração."""
from functools import lru_cache

from app.core.config import get_settings
from app.services.ai.abacus_provider import AbacusAIProvider
from app.services.ai.base import AIProvider
from app.services.ai.fake_provider import FakeAIProvider


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
    return FakeAIProvider()
