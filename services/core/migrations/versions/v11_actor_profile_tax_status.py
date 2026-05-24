"""Add tax_status to actor profiles

Revision ID: v11_actor_profile_tax_status
"""
from alembic import op


revision = 'v11_actor_profile_tax_status'
down_revision = 'v10_push_user_agent'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE actor_profiles "
        "ADD COLUMN IF NOT EXISTS tax_status VARCHAR(30)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE actor_profiles DROP COLUMN IF EXISTS tax_status"
    )
