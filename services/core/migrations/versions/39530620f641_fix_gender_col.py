"""fix gender col

Revision ID: 39530620f641
Revises: 0c2c0382b0ee
Create Date: 2025-07-14 19:30:20.030780

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from profiles.enums import Gender


# revision identifiers, used by Alembic.
revision: str = '39530620f641'
down_revision: Union[str, None] = '0c2c0382b0ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# определяем enum
gender_enum = sa.Enum(Gender)

def upgrade() -> None:
    """Upgrade schema."""
    # создаем ENUM тип
    gender_enum.create(op.get_bind(), checkfirst=True)

    # теперь меняем тип колонки с явным кастом
    op.alter_column(
        'profiles',
        'gender',
        existing_type=sa.VARCHAR(),
        type_=gender_enum,
        existing_nullable=True,
        postgresql_using="gender::gender"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # возвращаем тип в строку
    op.alter_column('profiles', 'gender',
               existing_type=gender_enum,
               type_=sa.VARCHAR(),
               existing_nullable=True)

    # удаляем ENUM тип
    gender_enum.drop(op.get_bind(), checkfirst=True)
