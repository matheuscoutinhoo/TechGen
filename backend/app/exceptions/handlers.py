"""Exception handlers globais."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions import DomainError


def _payload(code: str, message: str, details: dict | None = None) -> dict:
    body: dict = {"error": {"code": code, "message": message}}
    if details:
        body["error"]["details"] = details
    return body


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _handle_domain_error(_: Request, exc: DomainError):
        return JSONResponse(
            status_code=exc.http_status,
            content=_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(_: Request, exc: RequestValidationError):
        # Pydantic v2 inclui o ValueError original em ctx['error'] quando o
        # erro vem de um field_validator. Esse objeto não é JSON-serializável,
        # então normalizamos pra string antes de devolver.
        safe_errors = []
        for error in exc.errors():
            normalized = dict(error)
            ctx = normalized.get("ctx")
            if isinstance(ctx, dict):
                normalized["ctx"] = {
                    key: str(value) if isinstance(value, Exception) else value
                    for key, value in ctx.items()
                }
            safe_errors.append(normalized)
        return JSONResponse(
            status_code=422,
            content=_payload(
                "VALIDATION_ERROR",
                "Entrada inválida",
                {"errors": safe_errors},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http_error(_: Request, exc: StarletteHTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content=_payload("HTTP_ERROR", str(exc.detail)),
        )
