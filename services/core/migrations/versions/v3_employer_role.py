"""v3: Employer role + casting owner_id

- Add 'employer' to modelroles enum
- Add owner_id column to castings table

Revision ID: v3_employer_role
Revises: v3_oauth_providers
Create Date: 2026-02-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'v3_employer_role'
down_revision: Union[str, None] = 'v3_oauth_providers'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE modelroles ADD VALUE IF NOT EXISTS 'employer'")

    op.add_column('castings', sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True))
    op.create_index('ix_castings_owner_id', 'castings', ['owner_id'])


def downgrade() -> None:
    op.drop_index('ix_castings_owner_id', table_name='castings')
    op.drop_column('castings', 'owner_id')
