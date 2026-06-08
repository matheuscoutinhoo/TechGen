"""add assessment json to learning_trails

Revision ID: c4d5e6f7a8b9
Revises: 3bae62b19c1e
Create Date: 2026-06-07 22:10:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "3bae62b19c1e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "learning_trails",
        sa.Column("assessment_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("learning_trails", "assessment_json")
