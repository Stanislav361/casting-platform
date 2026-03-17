"""Add status column to profile_responses

Revision ID: v4_response_status
Revises: v3_v4_full
Create Date: 2026-03-10
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v4_response_status'
down_revision: Union[str, None] = 'v3_v4_full'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _col_exists(table: str, column: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    if not _col_exists("profile_responses", "status"):
        op.add_column(
            "profile_responses",
            sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        )


def downgrade() -> None:
    if _col_exists("profile_responses", "status"):
        op.drop_column("profile_responses", "status")
