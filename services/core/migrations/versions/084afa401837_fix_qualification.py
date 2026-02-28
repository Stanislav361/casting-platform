"""fix qualification

Revision ID: 084afa401837
Revises: 4b35cc11f414
Create Date: 2025-07-14 19:59:07.052820

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '084afa401837'
down_revision: Union[str, None] = '4b35cc11f414'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

qualification_enum = sa.Enum(
    "professional",
    "skilled",
    "enthusiast",
    "beginner",
    "other",
    name="qualification"
)

def upgrade() -> None:
    """Upgrade schema."""
    # Добавляем новое значение к существующему ENUM типу
    op.execute("ALTER TYPE qualification ADD VALUE IF NOT EXISTS 'other'")


def downgrade() -> None:
    """Downgrade schema."""
    # Удаление значения ENUM не поддерживается напрямую в PostgreSQL.
    # Чтобы это сделать, нужно создать новый ENUM без этого значения и пересоздать колонку.
    # Поэтому оставляем пустым или логируем предупреждение.
    pass
