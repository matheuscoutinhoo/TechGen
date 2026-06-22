"""Testes da criptografia simétrica de segredos (Fernet)."""
import pytest

from app.core.crypto import decrypt_secret, encrypt_secret, mask_secret


@pytest.mark.unit
class TestCrypto:
    def test_encrypt_decrypt_round_trip(self):
        secret = "sk-super-secret-key-1234"
        token = encrypt_secret(secret)
        # O token cifrado nunca é o texto puro.
        assert token != secret
        assert secret not in token
        assert decrypt_secret(token) == secret

    def test_encrypt_is_non_deterministic(self):
        # Fernet embute IV/timestamp: dois encrypts do mesmo valor diferem,
        # mas ambos decifram para o original.
        secret = "sk-abc-123-xyz-789"
        a = encrypt_secret(secret)
        b = encrypt_secret(secret)
        assert a != b
        assert decrypt_secret(a) == secret
        assert decrypt_secret(b) == secret

    def test_encrypt_rejects_empty(self):
        with pytest.raises(ValueError):
            encrypt_secret("")

    def test_decrypt_rejects_garbage(self):
        with pytest.raises(ValueError):
            decrypt_secret("not-a-valid-fernet-token")

    def test_mask_shows_only_tail(self):
        assert mask_secret("sk-abcdef1234") == "••••1234"

    def test_mask_never_exposes_full_long_secret(self):
        secret = "sk-proj-abcdefghijklmnop"
        masked = mask_secret(secret)
        assert masked.endswith("mnop")
        assert secret not in masked

    def test_mask_empty(self):
        assert mask_secret("") == ""
