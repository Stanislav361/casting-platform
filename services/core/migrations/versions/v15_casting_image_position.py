"""Add adjustable casting cover position

Revision ID: v15_casting_image_position
"""
from alembic import op


revision = 'v15_casting_image_position'
down_revision = 'v14_notification_pref_dates'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE casting_images "
        "ADD COLUMN IF NOT EXISTS object_position_x INTEGER NOT NULL DEFAULT 50"
    )
    op.execute(
        "ALTER TABLE casting_images "
        "ADD COLUMN IF NOT EXISTS object_position_y INTEGER NOT NULL DEFAULT 50"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE casting_images DROP COLUMN IF EXISTS object_position_x")
    op.execute("ALTER TABLE casting_images DROP COLUMN IF EXISTS object_position_y")
