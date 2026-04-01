"""Add review_status column to profiles_reports

Revision ID: v5_review_status_profiles_reports
"""
from alembic import op
import sqlalchemy as sa

revision = 'v5_review_status_profiles_reports'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE profiles_reports
        ADD COLUMN IF NOT EXISTS review_status VARCHAR NOT NULL DEFAULT 'new';
    """)


def downgrade() -> None:
    op.execute("""
        ALTER TABLE profiles_reports
        DROP COLUMN IF EXISTS review_status;
    """)
