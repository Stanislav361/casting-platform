"""Add shooting-date filter to notification preferences

Revision ID: v14_notification_pref_dates
"""
from alembic import op


revision = 'v14_notification_pref_dates'
down_revision = 'v13_notification_preferences'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE notification_preferences "
        "ADD COLUMN IF NOT EXISTS date_from DATE"
    )
    op.execute(
        "ALTER TABLE notification_preferences "
        "ADD COLUMN IF NOT EXISTS date_to DATE"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE notification_preferences DROP COLUMN IF EXISTS date_from")
    op.execute("ALTER TABLE notification_preferences DROP COLUMN IF EXISTS date_to")
