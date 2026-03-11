"""Add agent role to modelroles enum

Revision ID: v3_agent_role
Revises: v3_fix_chat_fk
Create Date: 2026-03-10
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'v3_agent_role'
down_revision: Union[str, None] = 'v3_fix_chat_fk'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE modelroles ADD VALUE IF NOT EXISTS 'agent'")


def downgrade() -> None:
    # PostgreSQL ENUM values cannot be safely removed in-place.
    pass
