"""Provider de IA usando a Abacus AI via API RouteLLM (compatível com OpenAI).

A Abacus expõe um endpoint ``/v1/chat/completions`` no host ``routellm.abacus.ai``
que segue o mesmo contrato da API de chat completions da OpenAI. Encapsulamos a
chamada HTTP aqui para que o restante do sistema dependa apenas da interface
``AIProvider``.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx
from pydantic import ValidationError

from app.exceptions import AIProviderError
from app.schemas.learning_trail import TrailContent
from app.services.ai.base import AIProvider
from app.services.ai.prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)

_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


class AbacusAIProvider(AIProvider):
    def __init__(
        self,
        *,
        api_url: str,
        api_key: str,
        model: str,
        timeout_seconds: int = 60,
        http_client: httpx.Client | None = None,
    ) -> None:
        if not api_key or not model:
            raise AIProviderError(
                "Provider Abacus mal configurado: api_key e model são obrigatórios"
            )
        # Aceita URLs com sufixos comuns (ex.: .../v1, .../v1/chat/completions)
        # e normaliza para a base esperada.
        base = api_url.rstrip("/")
        for suffix in ("/v1/chat/completions", "/v1"):
            if base.endswith(suffix):
                base = base[: -len(suffix)]
                break
        self.api_url = base
        self.api_key = api_key
        self.model = model
        self.timeout_seconds = timeout_seconds
        self._client = http_client

    def generate_learning_trail(self, topic: str) -> TrailContent:
        payload = self._build_payload(topic)
        raw = self._call_api(payload)
        text = self._extract_text(raw)
        data = self._parse_json(text)
        try:
            return TrailContent.model_validate(data)
        except ValidationError as exc:
            logger.warning("Resposta da Abacus não casou com o schema: %s", exc)
            raise AIProviderError(
                "A IA retornou uma trilha em formato inesperado. Tente novamente."
            ) from exc

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _build_payload(self, topic: str) -> dict[str, Any]:
        return {
            "model": self.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(topic)},
            ],
        }

    def _call_api(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.api_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            if self._client is not None:
                response = self._client.post(url, headers=headers, json=payload)
            else:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    response = client.post(url, headers=headers, json=payload)
        except httpx.TimeoutException as exc:
            logger.warning("Timeout (%ss) ao chamar Abacus", self.timeout_seconds)
            raise AIProviderError(
                f"A IA demorou mais que {self.timeout_seconds}s para responder. "
                "Aumente ABACUS_TIMEOUT_SECONDS no .env ou use um modelo mais rápido."
            ) from exc
        except httpx.HTTPError as exc:
            logger.exception("Falha de rede ao chamar Abacus")
            raise AIProviderError("Falha ao contatar a IA. Tente novamente em instantes.") from exc

        if response.status_code >= 400:
            body_snippet = response.text[:500].strip()
            logger.error(
                "Abacus retornou status %s em %s: %s",
                response.status_code,
                response.request.url,
                body_snippet,
            )
            raise AIProviderError(
                f"A IA respondeu com erro (HTTP {response.status_code}). "
                "Verifique credenciais, modelo e a URL configurados."
            )

        try:
            return response.json()
        except ValueError as exc:
            raise AIProviderError("Resposta da IA não é JSON válido.") from exc

    @staticmethod
    def _extract_text(raw: dict[str, Any]) -> str:
        """Extrai o ``content`` da primeira choice no formato OpenAI-compatible."""
        choices = raw.get("choices")
        if isinstance(choices, list) and choices:
            first = choices[0]
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str) and content.strip():
                        return content
                # variação de streaming consolidado: { "delta": { "content": "..." } }
                delta = first.get("delta")
                if isinstance(delta, dict):
                    content = delta.get("content")
                    if isinstance(content, str) and content.strip():
                        return content
        raise AIProviderError("Resposta da IA não contém texto utilizável.")

    @staticmethod
    def _parse_json(text: str) -> dict[str, Any]:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            cleaned = re.sub(r"^json", "", cleaned, flags=re.IGNORECASE).strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            match = _JSON_BLOCK_RE.search(cleaned)
            if not match:
                raise AIProviderError("A IA não retornou JSON reconhecível.")
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError as exc:
                raise AIProviderError("Não foi possível interpretar o JSON da IA.") from exc
