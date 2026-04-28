"""Add user_agent column to push_subscriptions

Revision ID: v10_push_user_agent
"""
from alembic import op


revision = 'v10_push_user_agent'
down_revision = 'v9_push_subscriptions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE push_subscriptions "
        "ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_push_sub_user "
        "ON push_subscriptions (user_id)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE push_subscriptions DROP COLUMN IF EXISTS user_agent"
    )
