"""Fixtures globais para os testes.

Cada teste roda contra um banco SQLite **in-memory** isolado para velocidade e
independência. Substituímos as dependências do FastAPI para injetar a sessão
de teste e um ``FakeAIProvider`` determinístico — a Abacus nunca é chamada.
"""
from __future__ import annotations

import os
from typing import Generator

# Garante config previsível antes de importar a app
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-1234567890")
os.environ.setdefault("AI_PROVIDER", "fake")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_ai_provider_dep
from app.db.base import Base
from app.db.session import get_db
from app.main import create_app
from app.services.ai.fake_provider import FakeAIProvider


@pytest.fixture
def engine():
    """Engine SQLite em memória, compartilhado entre conexões via StaticPool."""
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture
def db_session(engine) -> Generator[Session, None, None]:
    SessionTesting = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    session = SessionTesting()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def fake_ai_provider() -> FakeAIProvider:
    return FakeAIProvider()


@pytest.fixture
def app(engine, fake_ai_provider):
    SessionTesting = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)

    def _override_get_db():
        session = SessionTesting()
        try:
            yield session
        finally:
            session.close()

    application = create_app()
    application.dependency_overrides[get_db] = _override_get_db
    application.dependency_overrides[get_ai_provider_dep] = lambda: fake_ai_provider
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(app) -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def registered_user(client: TestClient) -> dict:
    """Registra um usuário e devolve o payload completo + token."""
    payload = {
        "name": "Ada Lovelace",
        "email": "ada@example.com",
        "password": "supersecret123",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201, response.text
    body = response.json()
    return {
        "credentials": payload,
        "user": body["user"],
        "token": body["access_token"],
    }


@pytest.fixture
def auth_headers(registered_user) -> dict[str, str]:
    return {"Authorization": f"Bearer {registered_user['token']}"}
