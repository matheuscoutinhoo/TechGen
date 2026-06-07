"""Testes de integração das rotas de autenticação."""
import pytest


@pytest.mark.integration
class TestRegisterEndpoint:
    def test_register_returns_token_and_user(self, client):
        response = client.post(
            "/api/v1/auth/register",
            json={"name": "Ada", "email": "ada@example.com", "password": "supersecret"},
        )
        assert response.status_code == 201
        body = response.json()
        assert "access_token" in body
        assert body["user"]["email"] == "ada@example.com"

    def test_register_rejects_invalid_email(self, client):
        response = client.post(
            "/api/v1/auth/register",
            json={"name": "Ada", "email": "not-an-email", "password": "supersecret"},
        )
        assert response.status_code == 422

    def test_register_rejects_short_password(self, client):
        response = client.post(
            "/api/v1/auth/register",
            json={"name": "Ada", "email": "ada@example.com", "password": "123"},
        )
        assert response.status_code == 422

    def test_register_conflicts_on_duplicate_email(self, client, registered_user):
        response = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Outra",
                "email": registered_user["credentials"]["email"],
                "password": "anotherpass1",
            },
        )
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "CONFLICT"


@pytest.mark.integration
class TestLoginEndpoint:
    def test_login_returns_token(self, client, registered_user):
        creds = registered_user["credentials"]
        response = client.post(
            "/api/v1/auth/login",
            json={"email": creds["email"], "password": creds["password"]},
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_login_returns_401_for_wrong_password(self, client, registered_user):
        creds = registered_user["credentials"]
        response = client.post(
            "/api/v1/auth/login",
            json={"email": creds["email"], "password": "wrongpass1234"},
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "AUTH_ERROR"

    def test_login_returns_401_for_unknown_email(self, client):
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "whateverpass"},
        )
        assert response.status_code == 401
