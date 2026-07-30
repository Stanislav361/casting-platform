"""v19: legal_consents — журнал акцепта Пользовательского соглашения и Оферты

Append-only таблица: каждый акцепт добавляет новую строку (не обновляет
существующую), чтобы сохранить полную историю согласий как электронное
доказательство (дата, время, версия документа, IP, User-Agent).

Revision ID: v19_legal_consents
Revises: v18_update_billing_prices
Create Date: 2026-07-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'v19_legal_consents'
down_revision: Union[str, None] = 'v18_update_billing_prices'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return table in insp.get_table_names()


def upgrade() -> None:
    if _table_exists('legal_consents'):
        return

    op.create_table(
        'legal_consents',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('document_type', sa.String(length=50), nullable=False),
        sa.Column('version', sa.String(length=50), nullable=False),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('accepted_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_legal_consents_user_id', 'legal_consents', ['user_id'])
    op.create_index('ix_legal_consents_document_type', 'legal_consents', ['document_type'])
    op.create_index(
        'ix_legal_consents_user_doc_accepted',
        'legal_consents',
        ['user_id', 'document_type', 'accepted_at'],
    )


def downgrade() -> None:
    if not _table_exists('legal_consents'):
        return
    op.drop_index('ix_legal_consents_user_doc_accepted', table_name='legal_consents')
    op.drop_index('ix_legal_consents_document_type', table_name='legal_consents')
    op.drop_index('ix_legal_consents_user_id', table_name='legal_consents')
    op.drop_table('legal_consents')
