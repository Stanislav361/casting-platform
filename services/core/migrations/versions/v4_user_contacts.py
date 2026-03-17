"""Add contact fields to users table

Revision ID: v4_user_contacts
Revises: v4_collaborators_subcasts
Create Date: 2026-03-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v4_user_contacts'
down_revision: Union[str, None] = 'v4_collaborators_subcasts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def _col_exists(table: str, column: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols

def upgrade() -> None:
    for col in ['telegram_nick', 'vk_nick', 'max_nick', 'middle_name']:
        if not _col_exists('users', col):
            op.add_column('users', sa.Column(col, sa.String(100), nullable=True))

def downgrade() -> None:
    for col in ['telegram_nick', 'vk_nick', 'max_nick', 'middle_name']:
        if _col_exists('users', col):
            op.drop_column('users', col)
