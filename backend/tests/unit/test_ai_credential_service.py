"""Testes do AICredentialService — cifra na escrita, mascara na leitura e monta
o provider per-user a partir da credencial decifrada."""
import pytest

from app.exceptions import NotFoundError
from app.models.user import User
from app.repositories.ai_credential_repository import AICredentialRepository
from app.schemas.ai_credential import AICredentialUpsert
from app.services.ai.abacus_provider import AbacusAIProvider
from app.services.ai.openai_provider import OpenAIAIProvider
from app.services.ai_credential_service import AICredentialService


@pytest.fixture
def user(db_session) -> User:
    u = User(name="Ada Lovelace", email="ada@example.com", password_hash="x")
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    return u


@pytest.fixture
def service(db_session) -> AICredentialService:
    return AICredentialService(AICredentialRepository(db_session))


@pytest.mark.unit
class TestAICredentialService:
    def test_status_not_configured_by_default(self, service, user):
        status = service.get_status(user)
        assert status.configured is False
        assert status.provider is None
        assert status.key_masked is None

    def test_upsert_encrypts_and_masks(self, service, user, db_session):
        payload = AICredentialUpsert(
            provider="openai", api_key="sk-secret-abcdef1234", model="gpt-4o"
        )
        status = service.upsert(user, payload)

        assert status.configured is True
        assert status.provider == "openai"
        assert status.model == "gpt-4o"
        assert status.key_masked == "••••1234"

        # No banco a chave está cifrada — nunca em texto puro.
        stored = AICredentialRepository(db_session).get_by_user(user.id)
        assert stored is not None
        assert stored.encrypted_api_key != "sk-secret-abcdef1234"
        assert "sk-secret-abcdef1234" not in stored.encrypted_api_key

    def test_get_status_after_upsert_is_masked(self, service, user):
        service.upsert(
            user, AICredentialUpsert(provider="abacus", api_key="key-abcdef9999")
        )
        status = service.get_status(user)
        assert status.provider == "abacus"
        assert status.key_masked == "••••9999"

    def test_upsert_replaces_existing(self, service, user, db_session):
        service.upsert(
            user, AICredentialUpsert(provider="abacus", api_key="key-aaaa1111")
        )
        service.upsert(
            user, AICredentialUpsert(provider="openai", api_key="sk-bbbb2222")
        )
        status = service.get_status(user)
        assert status.provider == "openai"
        assert status.key_masked == "••••2222"
        # Continua sendo UMA credencial por usuário.
        all_for_user = AICredentialRepository(db_session).get_by_user(user.id)
        assert all_for_user is not None

    def test_delete_removes_credential(self, service, user):
        service.upsert(
            user, AICredentialUpsert(provider="openai", api_key="sk-cccc3333")
        )
        service.delete(user)
        assert service.get_status(user).configured is False

    def test_delete_without_credential_raises(self, service, user):
        with pytest.raises(NotFoundError):
            service.delete(user)

    def test_build_provider_none_when_no_credential(self, service, user):
        assert service.build_provider(user) is None

    def test_build_provider_abacus_uses_decrypted_key(self, service, user):
        from app.core.config import get_settings

        service.upsert(
            user, AICredentialUpsert(provider="abacus", api_key="key-abacus-xyz")
        )
        provider = service.build_provider(user)
        assert isinstance(provider, AbacusAIProvider)
        assert not isinstance(provider, OpenAIAIProvider)
        # A chave usada no provider é o texto puro decifrado.
        assert provider.api_key == "key-abacus-xyz"
        # Sem modelo na credencial, cai no default global configurado.
        assert provider.model == get_settings().abacus_model

    def test_build_provider_openai_with_custom_model_and_url(self, service, user):
        service.upsert(
            user,
            AICredentialUpsert(
                provider="openai",
                api_key="sk-openai-key-123",
                model="gpt-4o",
                base_url="https://proxy.example/v1",
            ),
        )
        provider = service.build_provider(user)
        assert isinstance(provider, OpenAIAIProvider)
        assert provider.api_key == "sk-openai-key-123"
        assert provider.model == "gpt-4o"
        # base_url normalizada (sufixo /v1 removido).
        assert provider.api_url == "https://proxy.example"
