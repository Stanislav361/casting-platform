"""init dev users

Revision ID: f0a7c7d3d784
Revises: 3db2e24b6899
Create Date: 2025-06-01 09:08:48.829059

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f0a7c7d3d784'
down_revision: Union[str, None] = '3db2e24b6899'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Создаём ENUM тип
    casting_status_enum = sa.Enum('unpublished', 'published', 'closed', name='castingstatusenum')
    casting_status_enum.create(op.get_bind())

    # 2. Добавляем колонку временно nullable
    op.add_column('castings', sa.Column('status', casting_status_enum, nullable=True))

    # 3. Обновляем все существующие записи — задаём default, например 'unpublished'
    op.execute("UPDATE castings SET status = 'unpublished'")

    # 4. Меняем колонку на NOT NULL
    op.alter_column('castings', 'status', nullable=False)

    # 5. Удаляем старые поля
    op.drop_index('ix_castings_closed', table_name='castings')
    op.drop_index('ix_castings_published', table_name='castings')
    op.drop_column('castings', 'closed')
    op.drop_column('castings', 'published')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('castings', sa.Column('published', sa.BOOLEAN(), autoincrement=False, nullable=False))
    op.add_column('castings', sa.Column('closed', sa.BOOLEAN(), autoincrement=False, nullable=False))
    op.create_index('ix_castings_published', 'castings', ['published'], unique=False)
    op.create_index('ix_castings_closed', 'castings', ['closed'], unique=False)
    op.drop_column('castings', 'status')

    # Удалить ENUM тип
    op.execute('DROP TYPE castingstatusenum')