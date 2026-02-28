"""drop 3 max images сonstraint

Revision ID: d2148964e776
Revises: 14828a227d11
Create Date: 2025-07-14 22:53:09.178233

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd2148964e776'
down_revision: Union[str, None] = '14828a227d11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Удаляем старый constraint
    op.drop_constraint('max_images_constraint', 'profiles', type_='check')
    # Создаем новый с обновленным условием
    op.create_check_constraint(
        'max_images_constraint',
        'profiles',
        'image_counter <= 6'
    )


def downgrade() -> None:
    # Откат: удаляем новый constraint
    op.drop_constraint('max_images_constraint', 'profiles', type_='check')
    # Восстанавливаем старый
    op.create_check_constraint(
        'max_images_constraint',
        'profiles',
        'image_counter <= 3'
    )