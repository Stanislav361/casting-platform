"""v22: legal_consents — actor_profile_id, categories, user_id nullable

Добавляет поддержку двух новых документов из инструкции по внедрению:
Согласие Актёра на обработку данных Агентом (agent_authority_consent) и
Согласие законного представителя несовершеннолетнего
(minor_representative_consent). Оба собираются на публичном экране
/confirm-authority/{token} у Актёра/представителя, у которого может не
быть отдельного аккаунта на Платформе (Анкету создал Агент) — поэтому
согласие привязывается к `actor_profile_id`, а не к `user_id`.
Для этого `user_id` становится nullable (ровно одно из двух полей должно
быть заполнено — проверяется в legal.service).

Также добавляет `categories` (JSON) — детальный выбор категорий данных
для Согласия на распространение (distribution_consent), см.
legal.documents.DISTRIBUTION_CATEGORIES.

Revision ID: v22_legal_consent_profile_cat
Revises: v21_actor_profile_authority
Create Date: 2026-08-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'v22_legal_consent_profile_cat'
down_revision: Union[str, None] = 'v21_actor_profile_authority'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return column in {c['name'] for c in insp.get_columns(table)}


def _is_nullable(table: str, column: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    for c in insp.get_columns(table):
        if c['name'] == column:
            return bool(c['nullable'])
    return False


def _widen_alembic_version() -> None:
    """Расширить `alembic_version.version_num` до 64 символов.

    По умолчанию alembic создаёт эту колонку как varchar(32), и любая
    ревизия с более длинным ID падает уже после применения DDL — на
    попытке записать свой номер. В проекте ID ревизий описательные и
    некоторые вплотную упираются в лимит, поэтому расширяем один раз.
    """
    from sqlalchemy import inspect
    insp = inspect(op.get_bind())
    if 'alembic_version' not in insp.get_table_names():
        return
    for c in insp.get_columns('alembic_version'):
        if c['name'] != 'version_num':
            continue
        if (getattr(c['type'], 'length', None) or 0) >= 64:
            return
        op.alter_column(
            'alembic_version',
            'version_num',
            existing_type=sa.String(length=32),
            type_=sa.String(length=64),
            existing_nullable=False,
        )
        return


def upgrade() -> None:
    _widen_alembic_version()

    if not _is_nullable('legal_consents', 'user_id'):
        op.alter_column('legal_consents', 'user_id', existing_type=sa.Integer(), nullable=True)

    if not _has_column('legal_consents', 'actor_profile_id'):
        op.add_column(
            'legal_consents',
            sa.Column('actor_profile_id', sa.Integer(), sa.ForeignKey('actor_profiles.id', ondelete='CASCADE'), nullable=True),
        )
        op.create_index(
            'ix_legal_consents_actor_profile_id',
            'legal_consents',
            ['actor_profile_id'],
        )

    if not _has_column('legal_consents', 'categories'):
        op.add_column('legal_consents', sa.Column('categories', sa.JSON(), nullable=True))


def downgrade() -> None:
    if _has_column('legal_consents', 'categories'):
        op.drop_column('legal_consents', 'categories')

    if _has_column('legal_consents', 'actor_profile_id'):
        op.drop_index('ix_legal_consents_actor_profile_id', table_name='legal_consents')
        op.drop_column('legal_consents', 'actor_profile_id')

    op.alter_column('legal_consents', 'user_id', existing_type=sa.Integer(), nullable=False)
