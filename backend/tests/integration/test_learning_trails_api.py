"""Testes de integração das rotas de trilhas de aprendizado."""
import pytest


@pytest.mark.integration
class TestCreateTrail:
    def test_creates_trail_with_ai_generated_content(self, client, auth_headers):
        response = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={"topic": "FastAPI avançado"},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["topic"] == "FastAPI avançado"
        assert body["content"]["project_title"]
        assert len(body["content"]["tickets"]) >= 6
        first_ticket = body["content"]["tickets"][0]
        assert first_ticket["code"] == "TG-1"
        assert first_ticket["objective"]
        assert first_ticket["acceptance_criteria"]

    def test_create_with_assessment_propagates_answers_to_personalization(
        self, client, auth_headers
    ):
        response = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={
                "topic": "API design com FastAPI",
                "assessment": [
                    {
                        "question_id": "q1",
                        "question": "Você já usou FastAPI?",
                        "answer": "Nunca usei FastAPI",
                    }
                ],
            },
        )
        assert response.status_code == 201
        body = response.json()
        notes = " ".join(
            t.get("personalization_notes") or "" for t in body["content"]["tickets"]
        )
        assert "Nunca usei FastAPI" in notes

    def test_rejects_empty_topic(self, client, auth_headers):
        response = client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "a"}
        )
        assert response.status_code == 422

    def test_rejects_unauthenticated(self, client):
        response = client.post("/api/v1/learning-trails", json={"topic": "FastAPI"})
        assert response.status_code == 401


@pytest.mark.integration
class TestAssessmentEndpoint:
    def test_returns_first_question_for_empty_history(self, client, auth_headers):
        response = client.post(
            "/api/v1/learning-trails/assessment/next",
            headers=auth_headers,
            json={"topic": "FastAPI", "previous_answers": []},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["done"] is False
        question = body["question"]
        assert question["id"] == "q1"
        assert question["question"]
        assert 2 <= len(question["options"]) <= 5
        # alternativas devem ser específicas do tema
        assert any("FastAPI" in opt["label"] for opt in question["options"])

    def test_next_question_depends_on_previous_answer(self, client, auth_headers):
        """Caminhos opostos de resposta devem gerar perguntas diferentes."""
        low = client.post(
            "/api/v1/learning-trails/assessment/next",
            headers=auth_headers,
            json={
                "topic": "FastAPI",
                "previous_answers": [
                    {
                        "question_id": "q1",
                        "question": "Você já trabalhou com FastAPI antes?",
                        "answer": "Nunca usei FastAPI",
                    }
                ],
            },
        ).json()
        high = client.post(
            "/api/v1/learning-trails/assessment/next",
            headers=auth_headers,
            json={
                "topic": "FastAPI",
                "previous_answers": [
                    {
                        "question_id": "q1",
                        "question": "Você já trabalhou com FastAPI antes?",
                        "answer": "Uso FastAPI no dia a dia",
                    }
                ],
            },
        ).json()
        assert low["question"]["question"] != high["question"]["question"]
        assert low["question"]["id"] == "q2"

    def test_returns_done_when_history_full(self, client, auth_headers):
        previous = [
            {"question_id": f"q{i}", "question": f"P{i}?", "answer": f"R{i}"}
            for i in range(1, 6)
        ]
        response = client.post(
            "/api/v1/learning-trails/assessment/next",
            headers=auth_headers,
            json={"topic": "FastAPI", "previous_answers": previous},
        )
        body = response.json()
        assert body["done"] is True
        assert body["question"] is None

    def test_assessment_actually_changes_generated_trail(self, client, auth_headers):
        """End-to-end: respostas precisam afetar o conteúdo da trilha gerada."""
        without = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={"topic": "API design com FastAPI", "assessment": []},
        ).json()
        with_assessment = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={
                "topic": "API design com FastAPI",
                "assessment": [
                    {
                        "question_id": "q1",
                        "question": "Você já trabalhou com FastAPI antes?",
                        "answer": "Nunca usei FastAPI",
                    }
                ],
            },
        ).json()
        without_first = without["content"]["tickets"][0]
        with_first = with_assessment["content"]["tickets"][0]
        # Mudança observável no conteúdo gerado:
        assert without_first["title"] != with_first["title"]
        assert "Nunca usei FastAPI" in (with_first["personalization_notes"] or "")

    def test_rejects_short_topic(self, client, auth_headers):
        response = client.post(
            "/api/v1/learning-trails/assessment/next",
            headers=auth_headers,
            json={"topic": "a"},
        )
        assert response.status_code == 422

    def test_rejects_unauthenticated(self, client):
        response = client.post(
            "/api/v1/learning-trails/assessment/next", json={"topic": "FastAPI"}
        )
        assert response.status_code == 401


@pytest.mark.integration
class TestListTrails:
    def test_lists_only_user_trails(self, client, auth_headers):
        client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "Rust"}
        )
        client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "Kubernetes"}
        )
        response = client.get("/api/v1/learning-trails", headers=auth_headers)
        assert response.status_code == 200
        topics = [item["topic"] for item in response.json()]
        assert set(topics) == {"Rust", "Kubernetes"}


@pytest.mark.integration
class TestGetTrail:
    def test_returns_trail_details(self, client, auth_headers):
        created = client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "Docker"}
        ).json()
        response = client.get(
            f"/api/v1/learning-trails/{created['id']}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["id"] == created["id"]

    def test_trail_response_exposes_project_closure(self, client, auth_headers):
        """Contrato HTTP: a trilha sempre carrega final_deliverable e o último
        ticket é o ticket de entrega — o aluno não fica sem saber onde para."""
        created = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={"topic": "Docker"},
        ).json()
        content = created["content"]

        # final_deliverable está presente e cita o tema
        assert content.get("final_deliverable"), "final_deliverable ausente no payload"
        assert "docker" in content["final_deliverable"].lower()

        # Último ticket é a release/capstone, não roadmap/refatoração
        last = content["tickets"][-1]
        title_lower = last["title"].lower()
        assert any(
            keyword in title_lower
            for keyword in ("release", "entrega", "ponta a ponta", "end-to-end")
        ), f"Último ticket não é o capstone: {last['title']!r}"
        assert not any(
            forbidden in title_lower
            for forbidden in ("próximos passos", "roadmap")
        )

        # E os acceptance criteria validam o todo
        joined = " ".join(last["acceptance_criteria"]).lower()
        assert any(
            sentinel in joined
            for sentinel in ("resumo", "ponta a ponta", "outra pessoa", "reproduzir")
        )

    def test_returns_404_for_unknown_id(self, client, auth_headers):
        response = client.get("/api/v1/learning-trails/99999", headers=auth_headers)
        assert response.status_code == 404

    def test_forbids_access_to_another_users_trail(self, client, auth_headers):
        created = client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "Docker"}
        ).json()
        other = client.post(
            "/api/v1/auth/register",
            json={"name": "Xavier", "email": "x@example.com", "password": "anotherpass1"},
        ).json()
        other_headers = {"Authorization": f"Bearer {other['access_token']}"}
        response = client.get(
            f"/api/v1/learning-trails/{created['id']}", headers=other_headers
        )
        assert response.status_code == 403


@pytest.mark.integration
class TestUpdateTrail:
    def test_updates_title(self, client, auth_headers):
        created = client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "Golang"}
        ).json()
        response = client.patch(
            f"/api/v1/learning-trails/{created['id']}",
            headers=auth_headers,
            json={"title": "Minha trilha de Go"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Minha trilha de Go"


@pytest.mark.integration
class TestRegenerateTrail:
    def test_regenerates_keeping_topic(self, client, auth_headers):
        created = client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "GraphQL"}
        ).json()
        response = client.post(
            f"/api/v1/learning-trails/{created['id']}/regenerate",
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["topic"] == "GraphQL"


@pytest.mark.integration
class TestDeleteTrail:
    def test_deletes_trail(self, client, auth_headers):
        created = client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "Terraform"}
        ).json()
        response = client.delete(
            f"/api/v1/learning-trails/{created['id']}", headers=auth_headers
        )
        assert response.status_code == 204

        get_after = client.get(
            f"/api/v1/learning-trails/{created['id']}", headers=auth_headers
        )
        assert get_after.status_code == 404


@pytest.mark.integration
class TestCompleteTrail:
    def test_complete_marks_trail_and_promotes_concepts_to_skills(
        self, client, auth_headers
    ):
        created = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={"topic": "Elixir"},
        ).json()
        response = client.post(
            f"/api/v1/learning-trails/{created['id']}/complete",
            headers=auth_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["trail"]["completed_at"] is not None
        assert body["added_concepts"]

        skills = client.get("/api/v1/skills", headers=auth_headers).json()
        skill_names = {s["name"] for s in skills}
        for concept in body["added_concepts"]:
            assert concept in skill_names

    def test_second_complete_returns_conflict(self, client, auth_headers):
        created = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={"topic": "Crystal"},
        ).json()
        client.post(
            f"/api/v1/learning-trails/{created['id']}/complete",
            headers=auth_headers,
        )
        response = client.post(
            f"/api/v1/learning-trails/{created['id']}/complete",
            headers=auth_headers,
        )
        assert response.status_code == 409


@pytest.mark.integration
class TestExplainConcept:
    def test_returns_explanation_for_real_concept(self, client, auth_headers):
        created = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={"topic": "Haskell"},
        ).json()
        ticket = created["content"]["tickets"][0]
        concept = ticket["concepts"][0]
        response = client.get(
            f"/api/v1/learning-trails/{created['id']}"
            f"/tickets/{ticket['code']}/concepts/{concept}",
            headers=auth_headers,
        )
        assert response.status_code == 200
        body = response.json()
        assert body["concept"] == concept
        assert body["definition"]
        assert body["examples"]

    def test_returns_404_for_unknown_ticket(self, client, auth_headers):
        created = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={"topic": "Haskell"},
        ).json()
        response = client.get(
            f"/api/v1/learning-trails/{created['id']}"
            "/tickets/TG-999/concepts/foo",
            headers=auth_headers,
        )
        assert response.status_code == 404

    def test_refresh_query_param_bypasses_cache(
        self, client, auth_headers, fake_ai_provider
    ):
        calls = {"count": 0}
        original = fake_ai_provider.explain_concept

        def counted(*args, **kwargs):
            calls["count"] += 1
            return original(*args, **kwargs)

        fake_ai_provider.explain_concept = counted

        created = client.post(
            "/api/v1/learning-trails",
            headers=auth_headers,
            json={"topic": "Haskell"},
        ).json()
        ticket = created["content"]["tickets"][0]
        concept = ticket["concepts"][0]
        base_url = (
            f"/api/v1/learning-trails/{created['id']}"
            f"/tickets/{ticket['code']}/concepts/{concept}"
        )

        client.get(base_url, headers=auth_headers)
        client.get(base_url, headers=auth_headers)  # cache hit
        client.get(f"{base_url}?refresh=true", headers=auth_headers)

        assert calls["count"] == 2
