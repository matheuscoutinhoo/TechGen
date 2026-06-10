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

    def test_uploads_and_returns_avatar(self, client, auth_headers):
        png_b64 = (
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lE"
            "QVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
        )
        response = client.patch(
            "/api/v1/users/me", headers=auth_headers, json={"avatar_url": png_b64}
        )
        assert response.status_code == 200
        assert response.json()["avatar_url"] == png_b64
        me = client.get("/api/v1/users/me", headers=auth_headers).json()
        assert me["avatar_url"] == png_b64

    def test_removes_avatar_when_null(self, client, auth_headers):
        png_b64 = (
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lE"
            "QVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
        )
        client.patch(
            "/api/v1/users/me", headers=auth_headers, json={"avatar_url": png_b64}
        )
        response = client.patch(
            "/api/v1/users/me", headers=auth_headers, json={"avatar_url": None}
        )
        assert response.status_code == 200
        assert response.json()["avatar_url"] is None

    def test_rejects_invalid_avatar_data_url(self, client, auth_headers):
        response = client.patch(
            "/api/v1/users/me",
            headers=auth_headers,
            json={"avatar_url": "https://example.com/foto.png"},
        )
        assert response.status_code == 422

    def test_rejects_oversized_avatar(self, client, auth_headers):
        oversized = "data:image/png;base64," + ("A" * 700_000)
        response = client.patch(
            "/api/v1/users/me", headers=auth_headers, json={"avatar_url": oversized}
        )
        assert response.status_code == 422

    def test_update_without_avatar_does_not_clear_existing(self, client, auth_headers):
        """PATCH com só 'name' não pode apagar avatar — comportamento de unset."""
        png_b64 = (
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lE"
            "QVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
        )
        client.patch(
            "/api/v1/users/me", headers=auth_headers, json={"avatar_url": png_b64}
        )
        client.patch(
            "/api/v1/users/me", headers=auth_headers, json={"name": "Sem foto?"}
        )
        me = client.get("/api/v1/users/me", headers=auth_headers).json()
        assert me["name"] == "Sem foto?"
        assert me["avatar_url"] == png_b64


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
