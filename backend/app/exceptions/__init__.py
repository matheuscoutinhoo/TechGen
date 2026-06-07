"""Erros de domínio. Handlers mapeiam para respostas HTTP padronizadas."""
from __future__ import annotations


class DomainError(Exception):
    """Erro base do domínio. Subclasses representam categorias específicas."""

    code: str = "DOMAIN_ERROR"
    http_status: int = 400

    def __init__(self, message: str, *, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class AuthError(DomainError):
    code = "AUTH_ERROR"
    http_status = 401


class ForbiddenError(DomainError):
    code = "FORBIDDEN"
    http_status = 403


class NotFoundError(DomainError):
    code = "NOT_FOUND"
    http_status = 404


class ConflictError(DomainError):
    code = "CONFLICT"
    http_status = 409


class ValidationError(DomainError):
    code = "VALIDATION_ERROR"
    http_status = 422


class AIProviderError(DomainError):
    code = "AI_PROVIDER_ERROR"
    http_status = 502
