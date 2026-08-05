"""v20: legal_consents — колонки role и revoked_at

Роль пользователя на момент акцепта фиксируется в журнале (требование
внутренней инструкции по внедрению документов: «идентификатор пользователя
и роль» в записи о согласии). `revoked_at` нужен для отзываемых согласий
(например, рекламная рассылка) — сама запись об акцепте не удаляется и не
переписывается, только помечается временем отзыва, что сохраняет полную
историю как электронное доказательство.

Revision ID: v20_legal_consents_role_revoked
Revises: v19_legal_consents
Create Date: 2026-08-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'v20_legal_consents_role_revoked'
down_revision: Union[str, None] = 'v19_legal_consents'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return column in {c['name'] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column('legal_consents', 'role'):
        op.add_column('legal_consents', sa.Column('role', sa.String(length=50), nullable=True))
    if not _has_column('legal_consents', 'revoked_at'):
        op.add_column('legal_consents', sa.Column('revoked_at', sa.TIMESTAMP(timezone=True), nullable=True))


def downgrade() -> None:
    if _has_column('legal_consents', 'revoked_at'):
        op.drop_column('legal_consents', 'revoked_at')
    if _has_column('legal_consents', 'role'):
        op.drop_column('legal_consents', 'role')
