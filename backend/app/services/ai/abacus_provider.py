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
from typing import Any, Sequence

import httpx
from pydantic import ValidationError

from app.exceptions import AIProviderError
from app.schemas.learning_trail import (
    ConceptExplanation,
    TopicAnswer,
    TopicQuestion,
    TrailContent,
)
from app.services.ai.base import AIProvider, ConceptContext, UserSkillInput
from app.services.ai.prompts import (
    CATEGORIZER_SYSTEM_PROMPT,
    CONCEPT_SYSTEM_PROMPT,
    NEXT_PROJECT_QUESTION_SYSTEM_PROMPT,
    NEXT_QUESTION_SYSTEM_PROMPT,
    PROJECT_SYSTEM_PROMPT,
    SYSTEM_PROMPT,
    build_categorizer_prompt,
    build_concept_prompt,
    build_next_project_question_prompt,
    build_next_question_prompt,
    build_project_user_prompt,
    build_user_prompt,
)

logger = logging.getLogger(__name__)

# Temperatura das gerações CRIATIVAS (trilha por tema e por projeto). Mais
# alta do que o default para diversificar os projetos propostos — combinada
# com o bloco de diversidade dos prompts, evita que o mesmo tema gere sempre
# a mesma trilha. O parser de JSON é tolerante (fences/regex), então o leve
# aumento de criatividade não compromete a validação do schema.
_GENERATION_TEMPERATURE = 0.85

_JSON_BLOCK_RE = re.compile(r"\{.*\}", re.DOTALL)


def _serialize_skills(
    skills: Sequence[UserSkillInput],
) -> list[tuple[str, int, str]]:
    return [(skill.name, skill.level, skill.label) for skill in skills]


class AbacusAIProvider(AIProvider):
    # Rótulo do provider usado em logs e mensagens de erro. Subclasses (ex.:
    # OpenAI) sobrescrevem para refletir o serviço real, sem duplicar a lógica
    # HTTP — o contrato Chat Completions é idêntico.
    provider_label: str = "Abacus"

    def __init__(
        self,
        *,
        api_url: str,
        api_key: str,
        model: str,
        questions_model: str | None = None,
        concept_model: str | None = None,
        categorizer_model: str | None = None,
        timeout_seconds: int = 300,
        http_client: httpx.Client | None = None,
    ) -> None:
        if not api_key or not model:
            raise AIProviderError(
                f"Provider {self.provider_label} mal configurado: "
                "api_key e model são obrigatórios"
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
        # Modelo dedicado para perguntas de diagnóstico (mais leve/barato).
        # Fallback transparente no ``model`` principal quando não configurado.
        self.questions_model = (questions_model or "").strip() or model
        # Modelo dedicado para explicações de conceito (classe Sonnet: rápida
        # e com qualidade pedagógica). Fallback transparente no ``model``.
        self.concept_model = (concept_model or "").strip() or model
        # Modelo dedicado para categorização de skills (chamada barata).
        # Fallback transparente no ``model`` principal quando não configurado.
        self.categorizer_model = (categorizer_model or "").strip() or model
        self.timeout_seconds = timeout_seconds
        self._client = http_client

    def generate_next_topic_question(
        self,
        topic: str,
        *,
        skills: Sequence[UserSkillInput] = (),
        previous_answers: Sequence[TopicAnswer] = (),
    ) -> TopicQuestion | None:
        payload = self._build_next_question_payload(topic, skills, previous_answers)
        raw = self._call_api(payload)
        text = self._extract_text(raw)
        data = self._parse_json(text)

        if data.get("done") is True:
            # IA decidiu encerrar; sem pergunta. Service garante teto também.
            return None

        question_data = data.get("question")
        if not isinstance(question_data, dict):
            raise AIProviderError(
                "O Mentor não retornou nem uma pergunta nem o sinal de encerramento."
            )
        # Garante id sequencial mesmo se a IA repetir/errar a numeração.
        question_data["id"] = f"q{len(previous_answers) + 1}"
        try:
            return TopicQuestion.model_validate(question_data)
        except ValidationError as exc:
            logger.warning(
                "Resposta da Abacus não casou com o schema de pergunta: %s", exc
            )
            raise AIProviderError(
                "O Mentor retornou uma pergunta em formato inesperado. Tente novamente."
            ) from exc

    def generate_learning_trail(
        self,
        topic: str,
        *,
        skills: Sequence[UserSkillInput] = (),
        assessment: Sequence[TopicAnswer] = (),
    ) -> TrailContent:
        payload = self._build_trail_payload(topic, skills, assessment)
        raw = self._call_api(payload)
        text = self._extract_text(raw)
        data = self._parse_json(text)
        try:
            return TrailContent.model_validate(data)
        except ValidationError as exc:
            logger.warning("Resposta da Abacus não casou com o schema de trilha: %s", exc)
            raise AIProviderError(
                "O Mentor retornou uma trilha em formato inesperado. Tente novamente."
            ) from exc

    def generate_next_project_question(
        self,
        project_scope: str,
        *,
        technologies: Sequence[str] = (),
        skills: Sequence[UserSkillInput] = (),
        previous_answers: Sequence[TopicAnswer] = (),
    ) -> TopicQuestion | None:
        payload = self._build_next_project_question_payload(
            project_scope, technologies, skills, previous_answers
        )
        raw = self._call_api(payload)
        text = self._extract_text(raw)
        data = self._parse_json(text)

        if data.get("done") is True:
            return None

        question_data = data.get("question")
        if not isinstance(question_data, dict):
            raise AIProviderError(
                "O Mentor não retornou nem uma pergunta nem o sinal de encerramento."
            )
        question_data["id"] = f"q{len(previous_answers) + 1}"
        try:
            return TopicQuestion.model_validate(question_data)
        except ValidationError as exc:
            logger.warning(
                "Resposta da Abacus (modo PROJECT) não casou com o schema de pergunta: %s",
                exc,
            )
            raise AIProviderError(
                "O Mentor retornou uma pergunta em formato inesperado. Tente novamente."
            ) from exc

    def generate_project_trail(
        self,
        project_scope: str,
        *,
        technologies: Sequence[str] = (),
        skills: Sequence[UserSkillInput] = (),
        assessment: Sequence[TopicAnswer] = (),
    ) -> TrailContent:
        payload = self._build_project_trail_payload(
            project_scope, technologies, skills, assessment
        )
        raw = self._call_api(payload)
        text = self._extract_text(raw)
        data = self._parse_json(text)
        try:
            return TrailContent.model_validate(data)
        except ValidationError as exc:
            logger.warning(
                "Resposta da Abacus (modo PROJECT) não casou com o schema de trilha: %s",
                exc,
            )
            raise AIProviderError(
                "O Mentor retornou uma trilha em formato inesperado. Tente novamente."
            ) from exc

    def explain_concept(
        self,
        concept: str,
        *,
        context: ConceptContext,
        skills: Sequence[UserSkillInput] = (),
    ) -> ConceptExplanation:
        payload = self._build_concept_payload(concept, context, skills)
        raw = self._call_api(payload)
        text = self._extract_text(raw)
        data = self._parse_json(text)
        try:
            return ConceptExplanation.model_validate(data)
        except ValidationError as exc:
            logger.warning("Resposta da Abacus não casou com o schema de conceito: %s", exc)
            raise AIProviderError(
                "O Mentor retornou a explicação em formato inesperado. Tente novamente."
            ) from exc

    def categorize_concepts(self, concepts: Sequence[str]) -> list[str]:
        cleaned = [c.strip() for c in concepts if c and c.strip()]
        if not cleaned:
            return []
        payload = self._build_categorizer_payload(cleaned)
        raw = self._call_api(payload)
        text = self._extract_text(raw)
        data = self._parse_json(text)
        categories = data.get("categories")
        if not isinstance(categories, list):
            raise AIProviderError(
                "O Mentor não retornou a lista de categorias esperada."
            )
        # Normaliza: lowercase, trim, dedup (preservando ordem).
        seen: set[str] = set()
        out: list[str] = []
        for item in categories:
            if not isinstance(item, str):
                continue
            normalized = item.strip().lower()
            if not normalized or normalized in seen:
                continue
            seen.add(normalized)
            out.append(normalized)
        return out

    # ------------------------------------------------------------------ #
    # Payload builders
    # ------------------------------------------------------------------ #
    def _build_trail_payload(
        self,
        topic: str,
        skills: Sequence[UserSkillInput],
        assessment: Sequence[TopicAnswer],
    ) -> dict[str, Any]:
        return {
            "model": self.model,
            "stream": False,
            "temperature": _GENERATION_TEMPERATURE,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_user_prompt(
                        topic, _serialize_skills(skills), assessment
                    ),
                },
            ],
        }

    def _build_next_question_payload(
        self,
        topic: str,
        skills: Sequence[UserSkillInput],
        previous_answers: Sequence[TopicAnswer],
    ) -> dict[str, Any]:
        return {
            "model": self.questions_model,
            "stream": False,
            "messages": [
                {"role": "system", "content": NEXT_QUESTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_next_question_prompt(
                        topic,
                        skills=_serialize_skills(skills),
                        previous_answers=previous_answers,
                    ),
                },
            ],
        }

    def _build_project_trail_payload(
        self,
        project_scope: str,
        technologies: Sequence[str],
        skills: Sequence[UserSkillInput],
        assessment: Sequence[TopicAnswer],
    ) -> dict[str, Any]:
        return {
            "model": self.model,
            "stream": False,
            "temperature": _GENERATION_TEMPERATURE,
            "messages": [
                {"role": "system", "content": PROJECT_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_project_user_prompt(
                        project_scope,
                        technologies=technologies,
                        skills=_serialize_skills(skills),
                        assessment=assessment,
                    ),
                },
            ],
        }

    def _build_next_project_question_payload(
        self,
        project_scope: str,
        technologies: Sequence[str],
        skills: Sequence[UserSkillInput],
        previous_answers: Sequence[TopicAnswer],
    ) -> dict[str, Any]:
        return {
            "model": self.questions_model,
            "stream": False,
            "messages": [
                {"role": "system", "content": NEXT_PROJECT_QUESTION_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_next_project_question_prompt(
                        project_scope,
                        technologies=technologies,
                        skills=_serialize_skills(skills),
                        previous_answers=previous_answers,
                    ),
                },
            ],
        }

    def _build_categorizer_payload(
        self, concepts: Sequence[str]
    ) -> dict[str, Any]:
        return {
            "model": self.categorizer_model,
            "stream": False,
            "messages": [
                {"role": "system", "content": CATEGORIZER_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_categorizer_prompt(concepts),
                },
            ],
        }

    def _build_concept_payload(
        self,
        concept: str,
        context: ConceptContext,
        skills: Sequence[UserSkillInput],
    ) -> dict[str, Any]:
        return {
            "model": self.concept_model,
            "stream": False,
            "messages": [
                {"role": "system", "content": CONCEPT_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": build_concept_prompt(
                        concept=concept,
                        project_title=context.project_title,
                        ticket_title=context.ticket_title,
                        ticket_objective=context.ticket_objective,
                        skills=_serialize_skills(skills),
                    ),
                },
            ],
        }

    # ------------------------------------------------------------------ #
    # HTTP helpers
    # ------------------------------------------------------------------ #
    def _timeout_message(self) -> str:
        """Mensagem de timeout. Sobrescrita pelas subclasses por provider."""
        return (
            f"O Mentor demorou mais que {self.timeout_seconds}s para responder. "
            "Aumente ABACUS_TIMEOUT_SECONDS no .env ou use um modelo mais rápido."
        )

    def _credits_message(self) -> str:
        """Mensagem de conta sem créditos. Sobrescrita pelas subclasses."""
        return (
            "O Mentor está sem créditos na conta da Abacus AI para "
            "chamar o modelo. Recarregue os créditos no painel da "
            "Abacus ou troque ABACUS_MODEL/ABACUS_CONCEPT_MODEL por um "
            "modelo dentro do seu plano. Em desenvolvimento, defina "
            "AI_PROVIDER=fake no .env para trabalhar sem custo."
        )

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
            logger.warning(
                "Timeout (%ss) ao chamar %s", self.timeout_seconds, self.provider_label
            )
            raise AIProviderError(self._timeout_message()) from exc
        except httpx.HTTPError as exc:
            logger.exception("Falha de rede ao chamar %s", self.provider_label)
            raise AIProviderError("Falha ao contatar o Mentor. Tente novamente em instantes.") from exc

        if response.status_code >= 400:
            body_snippet = response.text[:500].strip()
            logger.error(
                "%s retornou status %s em %s: %s",
                self.provider_label,
                response.status_code,
                response.request.url,
                body_snippet,
            )
            lowered = body_snippet.lower()
            # Caso mais comum em dev: conta sem créditos. A mensagem genérica
            # ("verifique credenciais/modelo/URL") confunde — é mais honesto
            # dizer exatamente o que aconteceu e onde resolver.
            if "credit" in lowered or "quota" in lowered or "billing" in lowered:
                raise AIProviderError(self._credits_message())
            raise AIProviderError(
                f"O Mentor respondeu com erro (HTTP {response.status_code}). "
                "Verifique credenciais, modelo e a URL configurados."
            )

        try:
            return response.json()
        except ValueError as exc:
            raise AIProviderError("Resposta do Mentor não é JSON válido.") from exc

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
        raise AIProviderError("Resposta do Mentor não contém texto utilizável.")

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
                raise AIProviderError("O Mentor não retornou JSON reconhecível.")
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError as exc:
                raise AIProviderError("Não foi possível interpretar o JSON do Mentor.") from exc
