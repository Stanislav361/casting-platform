"""Add per-user notification preferences (casting filters)

Revision ID: v13_notification_preferences
"""
from alembic import op


revision = 'v13_notification_preferences'
down_revision = 'v12_actor_profile_metro_station'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS notification_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
            casting_filters_enabled BOOLEAN NOT NULL DEFAULT false,
            cities TEXT,
            genders TEXT,
            age_from INTEGER,
            age_to INTEGER,
            min_fee INTEGER,
            project_categories TEXT,
            role_types TEXT,
            date_from DATE,
            date_to DATE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_notification_preferences_user_id "
        "ON notification_preferences (user_id)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS notification_preferences")
