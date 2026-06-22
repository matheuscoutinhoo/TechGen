"""Testes do OpenAIAIProvider — reaproveita o pipeline do AbacusAIProvider,
mudando base URL, rótulo e mensagens. Cobrimos apenas o que difere; a lógica
de payload/parsing já é exercitada nos testes do Abacus."""
import httpx
import pytest
import respx

from app.exceptions import AIProviderError
from app.services.ai.abacus_provider import AbacusAIProvider
from app.services.ai.factory import build_provider_for_credential
from app.services.ai.openai_provider import DEFAULT_OPENAI_API_URL, OpenAIAIProvider

ENDPOINT = f"{DEFAULT_OPENAI_API_URL}/v1/chat/completions"


@pytest.mark.unit
class TestOpenAIAIProvider:
    def test_default_url_and_label(self):
        provider = OpenAIAIProvider(api_key="sk-x", model="gpt-4o-mini")
        assert provider.api_url == DEFAULT_OPENAI_API_URL
        assert provider.provider_label == "OpenAI"

    def test_custom_base_url_is_normalized(self):
        provider = OpenAIAIProvider(
            api_url="https://proxy.test/v1/chat/completions",
            api_key="sk-x",
            model="gpt-4o-mini",
        )
        assert provider.api_url == "https://proxy.test"

    def test_construction_requires_credentials(self):
        with pytest.raises(AIProviderError):
            OpenAIAIProvider(api_key="", model="gpt-4o-mini")
        with pytest.raises(AIProviderError):
            OpenAIAIProvider(api_key="sk-x", model="")

    @respx.mock
    def test_timeout_message_is_provider_specific(self):
        respx.post(ENDPOINT).mock(side_effect=httpx.ReadTimeout("timed out"))
        provider = OpenAIAIProvider(
            api_key="sk-x", model="gpt-4o-mini", timeout_seconds=9
        )
        with pytest.raises(AIProviderError) as excinfo:
            provider.generate_learning_trail("FastAPI")
        message = str(excinfo.value)
        assert "9s" in message
        assert "OpenAI" in message
        # Não vaza variáveis de ambiente específicas da Abacus.
        assert "ABACUS" not in message

    @respx.mock
    def test_credits_message_is_provider_specific(self):
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                400,
                json={"error": {"message": "You exceeded your current quota."}},
            )
        )
        provider = OpenAIAIProvider(api_key="sk-x", model="gpt-4o-mini")
        with pytest.raises(AIProviderError) as excinfo:
            provider.generate_learning_trail("FastAPI")
        message = str(excinfo.value)
        assert "OpenAI" in message
        assert "ABACUS" not in message

    def test_factory_unknown_provider_raises(self):
        with pytest.raises(AIProviderError):
            build_provider_for_credential(provider="gemini", api_key="x" * 8)

    def test_factory_builds_openai(self):
        provider = build_provider_for_credential(
            provider="openai", api_key="sk-x", model="gpt-4o"
        )
        assert isinstance(provider, OpenAIAIProvider)
        assert provider.model == "gpt-4o"


@pytest.mark.unit
class TestGlobalProviderSelection:
    """O provider GLOBAL (env) também é agnóstico: AI_PROVIDER escolhe a impl."""

    @staticmethod
    def _settings(provider: str):
        from types import SimpleNamespace

        return SimpleNamespace(
            ai_provider=provider,
            abacus_api_url="https://routellm.abacus.ai",
            abacus_api_key="k",
            abacus_model="gpt-5",
            abacus_questions_model="",
            abacus_concept_model="",
            abacus_categorizer_model="",
            abacus_timeout_seconds=300,
            openai_api_url="https://api.openai.com",
            openai_api_key="k",
            openai_model="gpt-4o-mini",
            openai_timeout_seconds=300,
        )

    def test_env_selects_each_provider(self, monkeypatch):
        from app.services.ai import factory
        from app.services.ai.fake_provider import FakeAIProvider

        try:
            monkeypatch.setattr(factory, "get_settings", lambda: self._settings("openai"))
            factory.get_ai_provider.cache_clear()
            assert isinstance(factory.get_ai_provider(), OpenAIAIProvider)

            monkeypatch.setattr(factory, "get_settings", lambda: self._settings("abacus"))
            factory.get_ai_provider.cache_clear()
            abacus = factory.get_ai_provider()
            assert isinstance(abacus, AbacusAIProvider)
            assert not isinstance(abacus, OpenAIAIProvider)

            monkeypatch.setattr(factory, "get_settings", lambda: self._settings("fake"))
            factory.get_ai_provider.cache_clear()
            assert isinstance(factory.get_ai_provider(), FakeAIProvider)
        finally:
            # Não vazar um provider montado de settings fake para outros testes.
            factory.get_ai_provider.cache_clear()
