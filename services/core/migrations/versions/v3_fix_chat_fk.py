"""Fix action_logs FK for general chat

Revision ID: v3_fix_chat_fk
Revises: v3_v4_full
Create Date: 2026-03-07
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'v3_fix_chat_fk'
down_revision: Union[str, None] = 'v3_v4_full'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('action_logs_casting_id_fkey', 'action_logs', type_='foreignkey')
    op.execute("ALTER TABLE action_logs ALTER COLUMN casting_id DROP NOT NULL;")


def downgrade() -> None:
    pass
