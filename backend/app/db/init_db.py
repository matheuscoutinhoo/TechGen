"""Inicialização do banco. Em produção, Alembic é a fonte de verdade.

Aqui criamos as tabelas no boot apenas para acelerar o ambiente de desenvolvimento
e testes. Migrations Alembic ficam responsáveis pela evolução do schema.
"""
from app.db.base import Base
from app.db.session import engine

# importar modelos garante que estão registrados no metadata da Base
from app.models import learning_trail as _learning_trail  # noqa: F401
from app.models import skill as _skill  # noqa: F401
from app.models import user as _user  # noqa: F401


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
