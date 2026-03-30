"""Add actor portfolio link and photo categories

Revision ID: v5_actor_profile_portfolio_rules
"""
from alembic import op
import sqlalchemy as sa

revision = 'v5_actor_profile_portfolio_rules'
down_revision = 'v5_actor_reviews'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE actor_profiles
        ADD COLUMN IF NOT EXISTS extra_portfolio_url VARCHAR(500)
        """
    )
    op.execute(
        """
        ALTER TABLE media_assets
        ADD COLUMN IF NOT EXISTS photo_category VARCHAR(30)
        """
    )


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE media_assets
        DROP COLUMN IF EXISTS photo_category
        """
    )
    op.execute(
        """
        ALTER TABLE actor_profiles
        DROP COLUMN IF EXISTS extra_portfolio_url
        """
    )
