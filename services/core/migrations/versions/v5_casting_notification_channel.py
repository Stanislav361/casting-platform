"""Add actor casting notification channel

Revision ID: v5_casting_notification_channel
"""
from alembic import op

revision = 'v5_casting_notification_channel'
down_revision = 'v5_actor_profile_portfolio_rules'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS casting_notification_channel VARCHAR(20) NOT NULL DEFAULT 'in_app'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE users
        DROP COLUMN IF EXISTS casting_notification_channel
        """
    )
