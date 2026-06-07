"""Testes de integração das rotas de usuário."""
import pytest


@pytest.mark.integration
class TestGetMe:
    def test_returns_current_user(self, client, auth_headers, registered_user):
        response = client.get("/api/v1/users/me", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["email"] == registered_user["user"]["email"]

    def test_rejects_unauthenticated(self, client):
        response = client.get("/api/v1/users/me")
        assert response.status_code == 401

    def test_rejects_invalid_token(self, client):
        response = client.get(
            "/api/v1/users/me", headers={"Authorization": "Bearer fake.token.value"}
        )
        assert response.status_code == 401


@pytest.mark.integration
class TestUpdateMe:
    def test_updates_name(self, client, auth_headers):
        response = client.patch(
            "/api/v1/users/me", headers=auth_headers, json={"name": "Ada Lovelace"}
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Ada Lovelace"

    def test_rejects_email_in_use(self, client, auth_headers):
        client.post(
            "/api/v1/auth/register",
            json={"name": "Xavier", "email": "other@example.com", "password": "anotherpass1"},
        )
        response = client.patch(
            "/api/v1/users/me", headers=auth_headers, json={"email": "other@example.com"}
        )
        assert response.status_code == 409


@pytest.mark.integration
class TestChangePassword:
    def test_changes_password_successfully(self, client, auth_headers, registered_user):
        response = client.post(
            "/api/v1/users/me/password",
            headers=auth_headers,
            json={
                "current_password": registered_user["credentials"]["password"],
                "new_password": "brandnewpass99",
            },
        )
        assert response.status_code == 204

        # nova senha autentica
        login = client.post(
            "/api/v1/auth/login",
            json={
                "email": registered_user["credentials"]["email"],
                "password": "brandnewpass99",
            },
        )
        assert login.status_code == 200

    def test_rejects_wrong_current_password(self, client, auth_headers):
        response = client.post(
            "/api/v1/users/me/password",
            headers=auth_headers,
            json={"current_password": "wrongpass1234", "new_password": "brandnewpass99"},
        )
        assert response.status_code == 401


@pytest.mark.integration
class TestDeleteMe:
    def test_deletes_account(self, client, auth_headers):
        response = client.delete("/api/v1/users/me", headers=auth_headers)
        assert response.status_code == 204

        # token continua válido em formato, mas usuário não existe mais
        me = client.get("/api/v1/users/me", headers=auth_headers)
        assert me.status_code == 401
