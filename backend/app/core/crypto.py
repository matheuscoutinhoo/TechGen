"""Criptografia simétrica para segredos do usuário (ex.: API keys BYOK).

Usa Fernet (AES-128-CBC + HMAC-SHA256) da biblioteca ``cryptography`` — fixada
explicitamente em ``requirements.txt`` e já disponível via
``python-jose[cryptography]``. Segredos como API keys de IA são cifrados antes
de tocar o banco e só decifrados no momento exato de montar o provider.

A chave de criptografia vem de ``ENCRYPTION_KEY`` (quando definida) ou é
derivada de ``SECRET_KEY``. Em ambos os casos derivamos uma chave Fernet
válida (32 bytes urlsafe-base64) de forma determinística, para que o que foi
cifrado continue decifrável entre reinicializações.

IMPORTANTE: segredos nunca são persistidos em texto puro nem registrados em log.
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings

# Quantos caracteres do final da chave permanecem visíveis ao mascarar.
_MASK_VISIBLE_CHARS = 4


def _derive_fernet_key(secret: str) -> bytes:
    """Deriva uma chave Fernet de 32 bytes (urlsafe-base64) a partir de um segredo.

    SHA-256 condensa o segredo de alta entropia em exatamente 32 bytes, que o
    ``urlsafe_b64encode`` converte no formato que o Fernet espera. Determinístico:
    o mesmo ``secret`` sempre gera a mesma chave. Trocar o segredo invalida os
    tokens já gravados (comportamento documentado em ``agents.md``).
    """
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _build_fernet() -> Fernet:
    settings = get_settings()
    secret = (settings.encryption_key or "").strip() or settings.secret_key
    return Fernet(_derive_fernet_key(secret))


def encrypt_secret(plaintext: str) -> str:
    """Cifra um segredo e devolve o token (str) pronto para persistir."""
    if not isinstance(plaintext, str) or plaintext == "":
        raise ValueError("Não é possível cifrar um segredo vazio")
    token = _build_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_secret(token: str) -> str:
    """Decifra um token gerado por :func:`encrypt_secret`.

    Levanta ``ValueError`` se o token estiver corrompido ou tiver sido cifrado
    com outra chave (ex.: ``SECRET_KEY`` rotacionada sem ``ENCRYPTION_KEY``).
    """
    try:
        return _build_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError) as exc:
        raise ValueError("Falha ao decifrar segredo armazenado") from exc


def mask_secret(plaintext: str, *, visible: int = _MASK_VISIBLE_CHARS) -> str:
    """Mascara um segredo, expondo só os últimos ``visible`` caracteres.

    Usado para devolver à UI uma prova de que a chave existe sem nunca vazar o
    valor completo (ex.: ``••••a1b2``).
    """
    if not plaintext:
        return ""
    tail = plaintext[-visible:] if len(plaintext) >= visible else plaintext
    return f"{'•' * 4}{tail}"
