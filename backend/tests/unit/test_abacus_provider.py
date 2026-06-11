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

    @respx.mock
    def test_skills_are_passed_in_the_user_prompt(self):
        from app.services.ai.base import UserSkillInput

        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(VALID_TRAIL_JSON))),
        )
        _provider().generate_learning_trail(
            "FastAPI",
            skills=[UserSkillInput(name="JWT", level=3, label="intermediate")],
        )
        body = json.loads(route.calls.last.request.content)
        user_content = body["messages"][1]["content"]
        assert "JWT" in user_content
        assert "intermediate" in user_content

    @respx.mock
    def test_explain_concept_returns_parsed_explanation(self):
        from app.services.ai.base import ConceptContext

        payload = {
            "concept": "Repository",
            "definition": "Definição com profundidade suficiente para passar.",
            "why_it_matters": "Importa porque desacopla camadas.",
            "patterns": ["P1", "P2"],
            "pitfalls": ["X1", "X2"],
            "tips": ["T1", "T2", "T3"],
            "examples": [
                {"title": "Ex1", "description": "Descrição razoável.", "code": "pass"}
            ],
            "hands_on_steps": ["Passo 1", "Passo 2", "Passo 3"],
            "further_reading": ["DDD"],
            "glossary": [{"term": "ORM", "brief": "Mapeamento objeto-relacional."}],
        }
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(payload))),
        )
        explanation = _provider().explain_concept(
            "Repository",
            context=ConceptContext(
                project_title="X",
                ticket_title="Persistência",
                ticket_objective="Implementar repositório.",
            ),
        )
        assert explanation.concept == "Repository"
        assert explanation.examples[0].title == "Ex1"

    @respx.mock
    def test_explain_concept_raises_when_schema_mismatch(self):
        from app.services.ai.base import ConceptContext

        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200, json=_openai_response(json.dumps({"oops": True}))
            ),
        )
        with pytest.raises(AIProviderError):
            _provider().explain_concept(
                "Repository",
                context=ConceptContext(
                    project_title="X",
                    ticket_title="Y",
                    ticket_objective="Z",
                ),
            )

    # ------------------------------------------------------------------ #
    # Diagnóstico adaptativo
    # ------------------------------------------------------------------ #
    @respx.mock
    def test_next_question_uses_questions_model(self):
        provider = AbacusAIProvider(
            api_url=API_URL,
            api_key="fake",
            model="claude-sonnet-4",
            questions_model="gemini-3.5-flash",
            timeout_seconds=5,
        )
        payload = {
            "done": False,
            "question": {
                "id": "q1",
                "question": "Você já trabalhou com FastAPI antes?",
                "rationale": "Mede familiaridade.",
                "options": [
                    {"id": "a", "label": "Nunca usei FastAPI"},
                    {"id": "b", "label": "Uso no dia a dia"},
                ],
            },
        }
        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(payload)))
        )
        question = provider.generate_next_topic_question("FastAPI")
        assert question is not None
        assert question.id == "q1"
        # confirma que mandou o modelo de questões (não o pesado)
        sent = json.loads(route.calls.last.request.content)
        assert sent["model"] == "gemini-3.5-flash"

    @respx.mock
    def test_next_question_includes_previous_answers_in_prompt(self):
        """O prompt enviado precisa carregar o histórico — é isso que torna a pergunta adaptativa."""
        from app.schemas.learning_trail import TopicAnswer

        payload = {
            "done": False,
            "question": {
                "id": "q2",
                "question": "Você se sente confortável com Python?",
                "rationale": "Sondar pré-requisito.",
                "options": [
                    {"id": "a", "label": "Não"},
                    {"id": "b", "label": "Sim"},
                ],
            },
        }
        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(payload)))
        )
        _provider().generate_next_topic_question(
            "FastAPI",
            previous_answers=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )
        body = json.loads(route.calls.last.request.content)
        user_content = body["messages"][1]["content"]
        # Histórico literalmente injetado no prompt:
        assert "Nunca usei FastAPI" in user_content
        assert "Você já trabalhou com FastAPI antes?" in user_content
        assert "Número de perguntas já feitas: 1" in user_content

    @respx.mock
    def test_next_question_returns_none_when_done_true(self):
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200,
                json=_openai_response(json.dumps({"done": True, "question": None})),
            )
        )
        assert _provider().generate_next_topic_question("FastAPI") is None

    @respx.mock
    def test_next_question_raises_when_payload_invalid(self):
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200,
                json=_openai_response(json.dumps({"done": False, "question": {}})),
            )
        )
        with pytest.raises(AIProviderError):
            _provider().generate_next_topic_question("FastAPI")

    @respx.mock
    def test_next_question_overrides_question_id_to_keep_sequence(self):
        """Mesmo se a IA repetir o id, o provider força sequência correta."""
        from app.schemas.learning_trail import TopicAnswer

        payload = {
            "done": False,
            "question": {
                "id": "q99",
                "question": "Pergunta nova?",
                "rationale": "Algo útil.",
                "options": [
                    {"id": "a", "label": "Opção A"},
                    {"id": "b", "label": "Opção B"},
                ],
            },
        }
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(payload)))
        )
        result = _provider().generate_next_topic_question(
            "X",
            previous_answers=[
                TopicAnswer(question_id="q1", question="?", answer="!"),
                TopicAnswer(question_id="q2", question="?", answer="!"),
            ],
        )
        assert result is not None
        assert result.id == "q3"  # forçado pelo provider

    # ------------------------------------------------------------------ #
    # Categorizador de skills
    # ------------------------------------------------------------------ #
    @respx.mock
    def test_categorize_uses_categorizer_model(self):
        provider = AbacusAIProvider(
            api_url=API_URL,
            api_key="fake",
            model="claude-sonnet-4",
            categorizer_model="claude-haiku-4-5-20251001",
            timeout_seconds=5,
        )
        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200,
                json=_openai_response(
                    json.dumps({"categories": ["autenticação", "banco de dados"]})
                ),
            )
        )
        provider.categorize_concepts(["JWT", "Repository"])
        body = json.loads(route.calls.last.request.content)
        assert body["model"] == "claude-haiku-4-5-20251001"

    @respx.mock
    def test_categorize_falls_back_to_model_when_not_configured(self):
        provider = AbacusAIProvider(
            api_url=API_URL,
            api_key="fake",
            model="claude-sonnet-4",
            timeout_seconds=5,
        )
        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200, json=_openai_response(json.dumps({"categories": ["python"]}))
            )
        )
        provider.categorize_concepts(["Pydantic"])
        body = json.loads(route.calls.last.request.content)
        assert body["model"] == "claude-sonnet-4"

    @respx.mock
    def test_categorize_normalizes_dedupes_and_lowercases(self):
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200,
                json=_openai_response(
                    json.dumps(
                        {
                            "categories": [
                                "Python",
                                "  python  ",
                                "API REST",
                                "Banco de Dados",
                                "Banco de dados",
                            ]
                        }
                    )
                ),
            )
        )
        result = _provider().categorize_concepts(["x", "y", "z"])
        assert result == ["python", "api rest", "banco de dados"]

    def test_categorize_empty_input_skips_api_call(self):
        # Sem respx.mock instalado: se chamasse a API, daria erro de rede.
        result = _provider().categorize_concepts([])
        assert result == []

    @respx.mock
    def test_categorize_raises_when_response_missing_categories(self):
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200, json=_openai_response(json.dumps({"oops": True}))
            )
        )
        with pytest.raises(AIProviderError):
            _provider().categorize_concepts(["JWT"])


# ====================================================================== #
# Modo PROJECT — aluno descreve escopo + tecnologias
# ====================================================================== #
PROJECT_SCOPE = (
    "Plataforma web onde pessoas cadastram livros usados para doação. "
    "Tem login, busca por título/autor e dashboard com ranking de doadores."
)
TECHNOLOGIES = ["FastAPI", "PostgreSQL", "React"]


@pytest.mark.unit
class TestAbacusProjectMode:
    @respx.mock
    def test_generate_project_trail_sends_scope_and_technologies(self):
        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200, json=_openai_response(json.dumps(VALID_TRAIL_JSON))
            )
        )
        trail = _provider().generate_project_trail(
            PROJECT_SCOPE, technologies=TECHNOLOGIES
        )
        assert trail.project_title == "Plataforma de exemplo"
        assert route.called
        body = json.loads(route.calls.last.request.content)
        # Usa o modelo principal (não o leve de questions).
        assert body["model"] == "gpt-5"
        user_content = body["messages"][1]["content"]
        # Escopo é colocado verbatim no prompt:
        assert "livros usados para doação" in user_content
        # Cada tecnologia declarada aparece no prompt:
        for tech in TECHNOLOGIES:
            assert tech in user_content

    @respx.mock
    def test_generate_project_trail_raises_when_schema_mismatch(self):
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200, json=_openai_response(json.dumps({"oops": True}))
            )
        )
        with pytest.raises(AIProviderError):
            _provider().generate_project_trail(
                PROJECT_SCOPE, technologies=TECHNOLOGIES
            )

    @respx.mock
    def test_next_project_question_uses_questions_model(self):
        provider = AbacusAIProvider(
            api_url=API_URL,
            api_key="fake",
            model="claude-sonnet-4",
            questions_model="gemini-3.5-flash",
            timeout_seconds=5,
        )
        payload = {
            "done": False,
            "question": {
                "id": "q1",
                "question": "Você já trabalhou com FastAPI antes?",
                "rationale": "Familiaridade com a stack principal.",
                "options": [
                    {"id": "a", "label": "Nunca usei FastAPI"},
                    {"id": "b", "label": "Uso em produção"},
                ],
            },
        }
        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(payload)))
        )
        question = provider.generate_next_project_question(
            PROJECT_SCOPE, technologies=TECHNOLOGIES
        )
        assert question is not None
        assert question.id == "q1"
        sent = json.loads(route.calls.last.request.content)
        assert sent["model"] == "gemini-3.5-flash"
        user_content = sent["messages"][1]["content"]
        assert "livros usados para doação" in user_content
        for tech in TECHNOLOGIES:
            assert tech in user_content

    @respx.mock
    def test_next_project_question_includes_previous_answers_in_prompt(self):
        from app.schemas.learning_trail import TopicAnswer

        payload = {
            "done": False,
            "question": {
                "id": "q2",
                "question": "Confortável com Python?",
                "rationale": "Pré-requisito da stack.",
                "options": [
                    {"id": "a", "label": "Não"},
                    {"id": "b", "label": "Sim"},
                ],
            },
        }
        route = respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(payload)))
        )
        _provider().generate_next_project_question(
            PROJECT_SCOPE,
            technologies=TECHNOLOGIES,
            previous_answers=[
                TopicAnswer(
                    question_id="q1",
                    question="Você já trabalhou com FastAPI antes?",
                    answer="Nunca usei FastAPI",
                )
            ],
        )
        body = json.loads(route.calls.last.request.content)
        user_content = body["messages"][1]["content"]
        assert "Nunca usei FastAPI" in user_content
        assert "Número de perguntas já feitas: 1" in user_content

    @respx.mock
    def test_next_project_question_returns_none_when_done_true(self):
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(
                200,
                json=_openai_response(json.dumps({"done": True, "question": None})),
            )
        )
        assert (
            _provider().generate_next_project_question(
                PROJECT_SCOPE, technologies=TECHNOLOGIES
            )
            is None
        )

    @respx.mock
    def test_next_project_question_overrides_id_to_keep_sequence(self):
        from app.schemas.learning_trail import TopicAnswer

        payload = {
            "done": False,
            "question": {
                "id": "q99",
                "question": "Pergunta nova?",
                "rationale": "Algo útil.",
                "options": [
                    {"id": "a", "label": "Opção A"},
                    {"id": "b", "label": "Opção B"},
                ],
            },
        }
        respx.post(ENDPOINT).mock(
            return_value=httpx.Response(200, json=_openai_response(json.dumps(payload)))
        )
        result = _provider().generate_next_project_question(
            PROJECT_SCOPE,
            technologies=TECHNOLOGIES,
            previous_answers=[
                TopicAnswer(question_id="q1", question="?", answer="!"),
                TopicAnswer(question_id="q2", question="?", answer="!"),
            ],
        )
        assert result is not None
        assert result.id == "q3"
