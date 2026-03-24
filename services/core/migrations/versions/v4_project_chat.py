"""Add project chat messages table

Revision ID: v4_project_chat
Revises: v4_user_contacts
Create Date: 2026-03-18
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v4_project_chat'
down_revision: Union[str, None] = 'v4_user_contacts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def _table_exists(table: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return table in insp.get_table_names()

def upgrade() -> None:
    if not _table_exists('project_chat_messages'):
        op.create_table(
            'project_chat_messages',
            sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
            sa.Column('casting_id', sa.Integer, sa.ForeignKey('castings.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('sender_id', sa.Integer, sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('message', sa.Text, nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_pcm_casting', 'project_chat_messages', ['casting_id'])

def downgrade() -> None:
    if _table_exists('project_chat_messages'):
        op.drop_table('project_chat_messages')
