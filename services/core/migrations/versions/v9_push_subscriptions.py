"""Add push_subscriptions table for Web Push notifications

Revision ID: v9_push_subscriptions
"""
from alembic import op


revision = 'v9_push_subscriptions'
down_revision = 'v8_casting_archive_flag'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id          SERIAL PRIMARY KEY,
            user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            endpoint    TEXT NOT NULL,
            p256dh      TEXT NOT NULL,
            auth        TEXT NOT NULL,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS ix_push_subscriptions_user
            ON push_subscriptions (user_id);
        CREATE UNIQUE INDEX IF NOT EXISTS ix_push_subscriptions_endpoint
            ON push_subscriptions (endpoint);
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS push_subscriptions;")
