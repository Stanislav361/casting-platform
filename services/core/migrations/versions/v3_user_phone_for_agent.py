"""Add phone_number to users for agent profile

Revision ID: v3_user_phone_for_agent
Revises: v3_agent_role
Create Date: 2026-03-11
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v3_user_phone_for_agent'
down_revision: Union[str, None] = 'v3_agent_role'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone_number', sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'phone_number')
