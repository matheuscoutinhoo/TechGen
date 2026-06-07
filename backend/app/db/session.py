"""Sessão e engine do SQLAlchemy.

Único ponto que conhece detalhes do banco. Em SQLite usamos
``check_same_thread=False`` porque o FastAPI compartilha o pool entre threads
do worker; em PostgreSQL esse argumento é simplesmente ignorado.
"""
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


def _build_engine(database_url: str) -> Engine:
    connect_args = {}
    if database_url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    return create_engine(database_url, connect_args=connect_args, future=True)


_settings = get_settings()
engine: Engine = _build_engine(_settings.database_url)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Generator[Session, None, None]:
    """Dependency do FastAPI: cria, entrega e fecha a sessão."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
