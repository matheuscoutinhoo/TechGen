"""Testes do AbacusAIProvider — mockando a camada HTTP com respx."""
import json

import httpx
import pytest
import respx

from app.exceptions import AIProviderError
from app.services.ai.abacus_provider import AbacusAIProvider

API_URL = "https://routellm.abacus.test"
ENDPOINT = f"{API_URL}/v1/chat/completions"

VALID_TRAIL_JSON = {
    "project_title": "Plataforma de exemplo",
    "project_summary": "Resumo realista do projeto pedagógico de exemplo.",
    "why_realistic": "Reproduz desafios reais de mercado em escala didática.",
    "target_audience": "Devs com fundamentos básicos.",
    "prerequisites": ["Git"],
    "tickets": [
        {
            "code": "TG-1",
            "title": "Setup",
            "objective": "Preparar o ambiente de desenvolvimento.",
            "concepts": ["ambiente"],
            "tasks": [{"description": "Instalar dependências"}],
            "acceptance_criteria": ["Comando hello roda"],
            "estimated_effort": "1h",
        }
    ],
}


def _provider() -> AbacusAIProvider:
    return AbacusAIProvider(
        api_url=API_URL,
        api_key="fake-key",
        model="gpt-5",
        timeout_seconds=5,
    )


def _openai_response(content: str) -> dict:
    return {
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "model": "gpt-5",
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }
        ],
    }


@pytest.mark.unit
class TestAbacusAIProvider:
    @respx.mock
    def test_returns_parsed_trail_on_success(self):
        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(VALID_TRAIL_JSON))),
        )
        trail = _provider().generate_learning_trail("FastAPI")
        assert trail.project_title == "Plataforma de exemplo"
        assert trail.tickets[0].code == "TG-1"

        # Confirma que enviamos no formato OpenAI-compatible.
        assert route.called
        sent = json.loads(route.calls.last.request.content)
        assert sent["model"] == "gpt-5"
        assert sent["stream"] is False
        assert sent["messages"][0]["role"] == "system"
        assert sent["messages"][1]["role"] == "user"
        assert route.calls.last.request.headers["authorization"] == "Bearer fake-key"

    @respx.mock
    def test_parses_json_wrapped_in_markdown_fence(self):
        wrapped = "```json\n" + json.dumps(VALID_TRAIL_JSON) + "\n```"
        respx.post(ENDPOINT).mock(return_value=httpx.Response(200, json=_openai_response(wrapped)))
        trail = _provider().generate_learning_trail("FastAPI")
        assert trail.tickets

    @respx.mock
    def test_raises_when_http_error(self):
        respx.post(ENDPOINT).mock(return_value=httpx.Response(500, text="boom"))
        with pytest.raises(AIProviderError):
            _provider().generate_learning_trail("FastAPI")

    @respx.mock
    def test_raises_when_response_is_not_json(self):
        respx.post(ENDPOINT).mock(return_value=httpx.Response(200, text="not json"))
        with pytest.raises(AIProviderError):
            _provider().generate_learning_trail("FastAPI")

    @respx.mock
    def test_raises_when_payload_does_not_match_schema(self):
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps({"unexpected": True}))),
        )
        with pytest.raises(AIProviderError):
            _provider().generate_learning_trail("FastAPI")

    @respx.mock
    def test_raises_when_choices_missing(self):
        respx.post(ENDPOINT).mock(return_value=httpx.Response(200, json={"choices": []}))
        with pytest.raises(AIProviderError):
            _provider().generate_learning_trail("FastAPI")

    def test_construction_requires_credentials(self):
        with pytest.raises(AIProviderError):
            AbacusAIProvider(api_url=API_URL, api_key="", model="gpt-5")
        with pytest.raises(AIProviderError):
            AbacusAIProvider(api_url=API_URL, api_key="key", model="")

    @pytest.mark.parametrize(
        "configured_url",
        [
            API_URL,
            f"{API_URL}/",
            f"{API_URL}/v1",
            f"{API_URL}/v1/",
            f"{API_URL}/v1/chat/completions",
        ],
    )
    def test_normalizes_api_url_suffixes(self, configured_url):
        provider = AbacusAIProvider(
            api_url=configured_url,
            api_key="fake",
            model="gpt-5",
            timeout_seconds=5,
        )
        assert provider.api_url == API_URL

    @respx.mock
    def test_http_error_message_exposes_status_code(self):
        respx.post(ENDPOINT).mock(return_value=httpx.Response(404, text="not found"))
        with pytest.raises(AIProviderError) as excinfo:
            _provider().generate_learning_trail("FastAPI")
        assert "HTTP 404" in str(excinfo.value)

    @respx.mock
    def test_timeout_error_message_mentions_timeout_value(self):
        respx.post(ENDPOINT).mock(side_effect=httpx.ReadTimeout("timed out"))
        with pytest.raises(AIProviderError) as excinfo:
            _provider().generate_learning_trail("FastAPI")
        message = str(excinfo.value)
        assert "5s" in message
        assert "ABACUS_TIMEOUT_SECONDS" in message
