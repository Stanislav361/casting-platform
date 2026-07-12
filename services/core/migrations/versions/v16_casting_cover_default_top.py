"""Default casting cover crop to top instead of center

Existing casting images were stored with object_position_y=50 (center)
by default, which can crop the top of a cover photo when it is rendered
with object-fit: cover. Since this position was never actually adjusted
by admins yet (the "adjust cover" slider just shipped), it's safe to
move the still-default rows to the top (0) so covers never crop the top.

Revision ID: v16_casting_cover_default_top
"""
from alembic import op


revision = 'v16_casting_cover_default_top'
down_revision = 'v15_casting_image_position'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE casting_images "
        "ALTER COLUMN object_position_y SET DEFAULT 0"
    )
    op.execute(
        "UPDATE casting_images SET object_position_y = 0 WHERE object_position_y = 50"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE casting_images "
        "ALTER COLUMN object_position_y SET DEFAULT 50"
    )
    op.execute(
        "UPDATE casting_images SET object_position_y = 50 WHERE object_position_y = 0"
    )
