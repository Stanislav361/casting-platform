"""Add published_by_id column to castings

Revision ID: v6_published_by
"""
from alembic import op
import sqlalchemy as sa

revision = 'v6_published_by'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'castings' AND column_name = 'published_by_id'
            ) THEN
                ALTER TABLE castings ADD COLUMN published_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
                CREATE INDEX ix_castings_published_by_id ON castings(published_by_id);
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'castings' AND column_name = 'published_by_id'
            ) THEN
                DROP INDEX IF EXISTS ix_castings_published_by_id;
                ALTER TABLE castings DROP COLUMN published_by_id;
            END IF;
        END
        $$;
    """)
