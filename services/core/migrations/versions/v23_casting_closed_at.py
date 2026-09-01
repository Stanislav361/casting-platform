"""v23: castings.closed_at — дата завершения кастинга

Интерфейс показывает у кастинга «Дату завершения», но хранить её было негде:
единственной похожей отметкой было `casting_posts.closed_at` (время закрытия
поста в Telegram), и она пропадала при снятии поста с публикации, а у кастингов
без публикации в канале её не было вовсе. Поэтому закрытые кастинги
показывались как «ещё активные».

Добавляем колонку и заполняем её для уже закрытых кастингов: берём время
закрытия поста, а если его нет — `updated_at`. Для закрытого кастинга это и
есть момент закрытия: редактировать закрытый кастинг нельзя, поэтому последнее
изменение — сама смена статуса.

Revision ID: v23_casting_closed_at
Revises: v22_legal_consent_profile_cat
Create Date: 2026-09-01
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'v23_casting_closed_at'
down_revision: Union[str, None] = 'v22_legal_consent_profile_cat'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return column in {c['name'] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column('castings', 'closed_at'):
        op.add_column('castings', sa.Column('closed_at', sa.TIMESTAMP(timezone=True), nullable=True))

    # status — это тип-перечисление в Postgres, поэтому сравниваем через ::text.
    op.execute(
        """
        UPDATE castings AS c
        SET closed_at = COALESCE(p.closed_at, c.updated_at, c.created_at)
        FROM casting_posts AS p
        WHERE p.casting_id = c.id
          AND c.status::text = 'closed'
          AND c.closed_at IS NULL
        """
    )
    op.execute(
        """
        UPDATE castings
        SET closed_at = COALESCE(updated_at, created_at)
        WHERE status::text = 'closed'
          AND closed_at IS NULL
        """
    )


def downgrade() -> None:
    if _has_column('castings', 'closed_at'):
        op.drop_column('castings', 'closed_at')
