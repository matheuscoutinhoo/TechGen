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

    def test_rejects_empty_topic(self, client, auth_headers):
        response = client.post(
            "/api/v1/learning-trails", headers=auth_headers, json={"topic": "a"}
        )
        assert response.status_code == 422

    def test_rejects_unauthenticated(self, client):
        response = client.post("/api/v1/learning-trails", json={"topic": "FastAPI"})
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
