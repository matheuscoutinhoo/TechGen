"""Provider de IA usando a API oficial da OpenAI.

A OpenAI expõe exatamente o contrato Chat Completions que o
``AbacusAIProvider`` já fala (``POST {base}/v1/chat/completions``, header
``Authorization: Bearer <key>``, resposta em ``choices[0].message.content``).
Por isso reaproveitamos toda a lógica de payload, parsing e tratamento de erro,
mudando apenas a base URL padrão, o rótulo do provider e as mensagens de erro
que citam variáveis de ambiente específicas da Abacus.
"""
from __future__ import annotations

import httpx

from app.services.ai.abacus_provider import AbacusAIProvider

# Host oficial da API da OpenAI. O provider base acrescenta /v1/chat/completions.
DEFAULT_OPENAI_API_URL = "https://api.openai.com"


class OpenAIAIProvider(AbacusAIProvider):
    provider_label: str = "OpenAI"

    def __init__(
        self,
        *,
        api_url: str | None = None,
        api_key: str,
        model: str,
        questions_model: str | None = None,
        concept_model: str | None = None,
        categorizer_model: str | None = None,
        timeout_seconds: int = 300,
        http_client: httpx.Client | None = None,
    ) -> None:
        super().__init__(
            api_url=api_url or DEFAULT_OPENAI_API_URL,
            api_key=api_key,
            model=model,
            questions_model=questions_model,
            concept_model=concept_model,
            categorizer_model=categorizer_model,
            timeout_seconds=timeout_seconds,
            http_client=http_client,
        )

    def _timeout_message(self) -> str:
        return (
            f"O Mentor (OpenAI) demorou mais que {self.timeout_seconds}s para "
            "responder. Tente novamente, escolha um modelo mais rápido ou "
            "aumente o timeout."
        )

    def _credits_message(self) -> str:
        return (
            "Sua conta OpenAI recusou a chamada por falta de créditos ou cota. "
            "Verifique o saldo e os limites de uso no painel da OpenAI, ou "
            "troque o modelo configurado na sua credencial."
        )
