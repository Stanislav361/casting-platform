"""Add extended casting fields (city, category, role_types, gender, age, finance, dates)

Revision ID: v7_casting_extended_fields
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'v7_casting_extended_fields'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='castings' AND column_name='city') THEN
                ALTER TABLE castings ADD COLUMN city VARCHAR(150);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='castings' AND column_name='project_category') THEN
                ALTER TABLE castings ADD COLUMN project_category VARCHAR(50);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='castings' AND column_name='role_types') THEN
                ALTER TABLE castings ADD COLUMN role_types JSONB;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='castings' AND column_name='gender') THEN
                ALTER TABLE castings ADD COLUMN gender VARCHAR(100);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='castings' AND column_name='age_from') THEN
                ALTER TABLE castings ADD COLUMN age_from INTEGER;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='castings' AND column_name='age_to') THEN
                ALTER TABLE castings ADD COLUMN age_to INTEGER;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='castings' AND column_name='financial_conditions') THEN
                ALTER TABLE castings ADD COLUMN financial_conditions VARCHAR(255);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='castings' AND column_name='shooting_dates') THEN
                ALTER TABLE castings ADD COLUMN shooting_dates VARCHAR(255);
            END IF;
        END
        $$;
    """)


def downgrade() -> None:
    for col in ['city', 'project_category', 'role_types', 'gender', 'age_from', 'age_to', 'financial_conditions', 'shooting_dates']:
        op.drop_column('castings', col)
