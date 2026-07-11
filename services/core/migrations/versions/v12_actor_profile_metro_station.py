"""Add metro station to actor profiles

Revision ID: v12_actor_profile_metro_station
"""
from alembic import op


revision = 'v12_actor_profile_metro_station'
down_revision = 'v11_actor_profile_tax_status'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE actor_profiles "
        "ADD COLUMN IF NOT EXISTS metro_station VARCHAR(200)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE actor_profiles DROP COLUMN IF EXISTS metro_station"
    )
