"""Add archive flag for projects

Revision ID: v8_casting_archive_flag
"""
from alembic import op


revision = 'v8_casting_archive_flag'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name='castings' AND column_name='is_archived'
            ) THEN
                ALTER TABLE castings ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
            END IF;

            IF NOT EXISTS (
                SELECT 1
                FROM pg_indexes
                WHERE tablename='castings' AND indexname='ix_castings_is_archived'
            ) THEN
                CREATE INDEX ix_castings_is_archived ON castings (is_archived);
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_castings_is_archived;")
    op.execute("ALTER TABLE castings DROP COLUMN IF EXISTS is_archived;")
