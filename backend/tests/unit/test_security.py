"""Testes unitários do módulo de segurança."""
import pytest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


@pytest.mark.unit
class TestPasswordHashing:
    def test_hash_password_produces_string_distinct_from_plain(self):
        plain = "supersecret123"
        hashed = hash_password(plain)
        assert hashed != plain
        assert isinstance(hashed, str) and len(hashed) > 20

    def test_verify_password_returns_true_for_matching_pair(self):
        plain = "supersecret123"
        assert verify_password(plain, hash_password(plain)) is True

    def test_verify_password_returns_false_for_wrong_password(self):
        assert verify_password("wrong", hash_password("right1234")) is False


@pytest.mark.unit
class TestJWT:
    def test_token_round_trip_returns_subject(self):
        token = create_access_token(subject=42)
        assert decode_access_token(token) == "42"

    def test_decode_returns_none_for_garbage_token(self):
        assert decode_access_token("not-a-real-token") is None
