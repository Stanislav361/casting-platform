"""Actor reviews / rating table

Revision ID: v5_actor_reviews
"""
from alembic import op
import sqlalchemy as sa

revision = 'v5_actor_reviews'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS actor_reviews (
            id SERIAL PRIMARY KEY,
            profile_id INTEGER NOT NULL,
            reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_actor_reviews_profile ON actor_reviews (profile_id, created_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_actor_reviews_reviewer ON actor_reviews (reviewer_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS actor_reviews")
