"""Testes de integração da API de credenciais de IA (BYOK).

Foco em segurança: a chave entra via PUT e nunca volta em texto puro; GET e PUT
devolvem apenas metadados + máscara. Autorização e validação no boundary.
"""
import pytest

URL = "/api/v1/ai-credentials"


@pytest.mark.integration
class TestAICredentialsAPI:
    def test_get_not_configured(self, client, auth_headers):
        resp = client.get(URL, headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["configured"] is False
        assert body["provider"] is None
        assert body["key_masked"] is None

    def test_put_creates_and_masks_key(self, client, auth_headers):
        payload = {
            "provider": "openai",
            "api_key": "sk-secret-abcdef1234",
            "model": "gpt-4o",
        }
        resp = client.put(URL, headers=auth_headers, json=payload)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["configured"] is True
        assert body["provider"] == "openai"
        assert body["model"] == "gpt-4o"
        assert body["key_masked"].endswith("1234")
        # A chave inteira NUNCA aparece na resposta.
        assert "sk-secret-abcdef1234" not in resp.text

    def test_get_after_put_returns_masked(self, client, auth_headers):
        client.put(
            URL,
            headers=auth_headers,
            json={"provider": "abacus", "api_key": "key-abcdef9999"},
        )
        resp = client.get(URL, headers=auth_headers)
        body = resp.json()
        assert body["configured"] is True
        assert body["provider"] == "abacus"
        assert body["key_masked"].endswith("9999")
        assert "key-abcdef9999" not in resp.text

    def test_put_replaces_existing_credential(self, client, auth_headers):
        client.put(
            URL,
            headers=auth_headers,
            json={"provider": "abacus", "api_key": "key-aaaa1111"},
        )
        resp = client.put(
            URL,
            headers=auth_headers,
            json={"provider": "openai", "api_key": "sk-bbbb2222"},
        )
        assert resp.json()["provider"] == "openai"
        assert resp.json()["key_masked"].endswith("2222")

    def test_delete_removes_credential(self, client, auth_headers):
        client.put(
            URL,
            headers=auth_headers,
            json={"provider": "openai", "api_key": "sk-cccc3333"},
        )
        resp = client.delete(URL, headers=auth_headers)
        assert resp.status_code == 204
        assert client.get(URL, headers=auth_headers).json()["configured"] is False

    def test_delete_without_credential_is_404(self, client, auth_headers):
        resp = client.delete(URL, headers=auth_headers)
        assert resp.status_code == 404

    def test_requires_authentication(self, client):
        assert client.get(URL).status_code == 401
        assert (
            client.put(URL, json={"provider": "openai", "api_key": "sk-xxxxxxxx"}).status_code
            == 401
        )
        assert client.delete(URL).status_code == 401

    def test_rejects_invalid_provider(self, client, auth_headers):
        resp = client.put(
            URL,
            headers=auth_headers,
            json={"provider": "gemini", "api_key": "sk-xxxxxxxx"},
        )
        assert resp.status_code == 422

    def test_rejects_short_key(self, client, auth_headers):
        resp = client.put(
            URL,
            headers=auth_headers,
            json={"provider": "openai", "api_key": "short"},
        )
        assert resp.status_code == 422

    def test_rejects_bad_base_url(self, client, auth_headers):
        resp = client.put(
            URL,
            headers=auth_headers,
            json={
                "provider": "openai",
                "api_key": "sk-abcdef1234",
                "base_url": "ftp://nope",
            },
        )
        assert resp.status_code == 422

    def test_credential_isolated_per_user(self, client, auth_headers):
        # Usuário A configura credencial.
        client.put(
            URL,
            headers=auth_headers,
            json={"provider": "openai", "api_key": "sk-userA-1234"},
        )
        # Usuário B (novo) não enxerga a credencial de A.
        other = client.post(
            "/api/v1/auth/register",
            json={
                "name": "Bob",
                "email": "bob@example.com",
                "password": "supersecret123",
            },
        )
        token_b = other.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}
        assert client.get(URL, headers=headers_b).json()["configured"] is False
