"""Testes de integração das rotas de skills."""
import pytest


@pytest.mark.integration
class TestListSkills:
    def test_returns_empty_list_initially(self, client, auth_headers):
        response = client.get("/api/v1/skills", headers=auth_headers)
        assert response.status_code == 200
        assert response.json() == []


@pytest.mark.integration
class TestAddSkill:
    def test_creates_skill_with_proficiency_label(self, client, auth_headers):
        response = client.post(
            "/api/v1/skills",
            headers=auth_headers,
            json={"name": "FastAPI", "proficiency": 3},
        )
        assert response.status_code == 201
        body = response.json()
        assert body["name"] == "fastapi"
        assert body["proficiency"] == 3
        assert body["proficiency_label"] == "intermediate"

    def test_rejects_duplicate(self, client, auth_headers):
        client.post(
            "/api/v1/skills",
            headers=auth_headers,
            json={"name": "TDD", "proficiency": 2},
        )
        response = client.post(
            "/api/v1/skills",
            headers=auth_headers,
            json={"name": "TDD", "proficiency": 3},
        )
        assert response.status_code == 409

    def test_rejects_invalid_proficiency(self, client, auth_headers):
        response = client.post(
            "/api/v1/skills",
            headers=auth_headers,
            json={"name": "TDD", "proficiency": 9},
        )
        assert response.status_code == 422


@pytest.mark.integration
class TestUpdateSkill:
    def test_updates_proficiency(self, client, auth_headers):
        created = client.post(
            "/api/v1/skills",
            headers=auth_headers,
            json={"name": "Go", "proficiency": 1},
        ).json()
        response = client.patch(
            f"/api/v1/skills/{created['id']}",
            headers=auth_headers,
            json={"proficiency": 3},
        )
        assert response.status_code == 200
        assert response.json()["proficiency"] == 3


@pytest.mark.integration
class TestDeleteSkill:
    def test_deletes_skill(self, client, auth_headers):
        created = client.post(
            "/api/v1/skills",
            headers=auth_headers,
            json={"name": "Rust", "proficiency": 2},
        ).json()
        response = client.delete(
            f"/api/v1/skills/{created['id']}", headers=auth_headers
        )
        assert response.status_code == 204

        listing = client.get("/api/v1/skills", headers=auth_headers).json()
        assert listing == []


@pytest.mark.integration
class TestRegisterWithSkills:
    def test_register_persists_initial_skills(self, client):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Linus Torvalds",
                "email": "linus@example.com",
                "password": "supersecret",
                "skills": [
                    {"name": "C", "proficiency": 4},
                    {"name": "Git", "proficiency": 4},
                ],
            },
        )
        assert response.status_code == 201
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        listing = client.get("/api/v1/skills", headers=headers).json()
        assert {s["name"] for s in listing} == {"c", "git"}