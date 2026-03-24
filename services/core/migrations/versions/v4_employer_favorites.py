"""Add employer_favorites table

Revision ID: v4_employer_favorites
Revises: v4_project_chat
Create Date: 2026-03-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v4_employer_favorites'
down_revision: Union[str, None] = 'v4_project_chat'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def _table_exists(table: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return table in insp.get_table_names()

def upgrade() -> None:
    if not _table_exists('employer_favorites'):
        op.create_table(
            'employer_favorites',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('profile_id', sa.Integer(), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint('user_id', 'profile_id', name='uq_employer_favorite'),
        )

def downgrade() -> None:
    if _table_exists('employer_favorites'):
        op.drop_table('employer_favorites')
