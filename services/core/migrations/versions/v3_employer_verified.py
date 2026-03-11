"""Add is_employer_verified to users table

Revision ID: v3_employer_verified
Revises: v3_user_phone_for_agent
"""
from alembic import op
import sqlalchemy as sa

revision = 'v3_employer_verified'
down_revision = 'v3_user_phone_for_agent'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_employer_verified', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('users', 'is_employer_verified')
