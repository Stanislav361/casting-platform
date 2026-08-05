"""v21: actor_profiles — подтверждение полномочий (Агент создаёт Анкету)

Инструкция по внедрению документов требует: когда Анкету создаёт Агент (а не
сам Актёр), нужно подтверждение полномочий — загрузка документа или
подтверждение самим Актёром — ДО публикации Анкеты. Реализуем через ссылку
подтверждения: пока актёр (или его законный представитель, если Актёр
несовершеннолетний) не подтвердит по ссылке, Анкета не участвует в
кастингах и с неё нельзя откликнуться (см. actor_profiles.service.
compute_profile_readiness).

Анкеты, созданные самим Актёром (self-service, только 18+), в подтверждении
не нуждаются — для них `authority_status` сразу 'confirmed'.

Revision ID: v21_actor_profile_authority
Revises: v20_legal_consents_role_revoked
Create Date: 2026-08-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'v21_actor_profile_authority'
down_revision: Union[str, None] = 'v20_legal_consents_role_revoked'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return column in {c['name'] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column('actor_profiles', 'authority_status'):
        op.add_column(
            'actor_profiles',
            sa.Column('authority_status', sa.String(length=30), nullable=False, server_default='confirmed'),
        )
    if not _has_column('actor_profiles', 'authority_confirmation_token'):
        op.add_column(
            'actor_profiles',
            sa.Column('authority_confirmation_token', sa.String(length=64), nullable=True),
        )
        op.create_index(
            'ix_actor_profiles_authority_token',
            'actor_profiles',
            ['authority_confirmation_token'],
            unique=True,
        )
    if not _has_column('actor_profiles', 'authority_confirmed_at'):
        op.add_column(
            'actor_profiles',
            sa.Column('authority_confirmed_at', sa.TIMESTAMP(timezone=True), nullable=True),
        )


def downgrade() -> None:
    if _has_column('actor_profiles', 'authority_confirmed_at'):
        op.drop_column('actor_profiles', 'authority_confirmed_at')
    if _has_column('actor_profiles', 'authority_confirmation_token'):
        op.drop_index('ix_actor_profiles_authority_token', table_name='actor_profiles')
        op.drop_column('actor_profiles', 'authority_confirmation_token')
    if _has_column('actor_profiles', 'authority_status'):
        op.drop_column('actor_profiles', 'authority_status')
