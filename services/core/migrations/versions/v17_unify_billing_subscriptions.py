"""v17: unify billing/subscriptions into a single mechanism

Ранее в проекте существовали два независимых, несогласованных механизма
тарифов/подписок:
  1) billing_plans + user_subscriptions (коды 'basic'/'pro', grace-период 24ч) —
     billing/models.py
  2) subscriptions (коды 'admin'/'admin_pro', без grace-периода) —
     employer/subscription.py (модуль удалён из кода)

Эта миграция:
  - переименовывает коды тарифов в billing_plans: 'basic' -> 'admin', 'pro' -> 'admin_pro',
    чтобы совпадать с терминологией ролей (employer/employer_pro) и документов оферты;
  - переносит все существующие строки из устаревшей таблицы `subscriptions`
    в единую `user_subscriptions` (на случай, если там уже есть реальные данные);
  - удаляет устаревшую таблицу `subscriptions` и её индексы.

Revision ID: v17_unify_billing_subscriptions
Revises: v4_employer_favorites
Create Date: 2026-07-28
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v17_unify_billing_subscriptions'
down_revision: Union[str, None] = 'v4_employer_favorites'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return table in insp.get_table_names()


def upgrade() -> None:
    if _table_exists('billing_plans'):
        op.execute("UPDATE billing_plans SET code = 'admin' WHERE code = 'basic'")
        op.execute("UPDATE billing_plans SET code = 'admin_pro' WHERE code = 'pro'")

    if _table_exists('subscriptions') and _table_exists('user_subscriptions') and _table_exists('billing_plans'):
        # Переносим legacy-строки, сопоставляя старый код тарифа ('admin'/'admin_pro',
        # уже совпадает с новыми кодами billing_plans после переименования выше) с id плана.
        op.execute("""
            INSERT INTO user_subscriptions
                (user_id, plan_id, status, starts_at, expires_at, grace_until, auto_renew, created_at, updated_at)
            SELECT
                s.user_id,
                bp.id,
                CASE
                    WHEN s.is_active AND s.expires_at >= now() THEN 'active'
                    ELSE 'expired'
                END,
                s.starts_at,
                s.expires_at,
                s.expires_at + INTERVAL '24 hours',
                true,
                s.created_at,
                now()
            FROM subscriptions s
            JOIN billing_plans bp ON bp.code = s.plan
            WHERE NOT EXISTS (
                SELECT 1 FROM user_subscriptions us
                WHERE us.user_id = s.user_id AND us.starts_at = s.starts_at
            )
        """)

    if _table_exists('subscriptions'):
        op.execute("DROP INDEX IF EXISTS ix_subscriptions_active")
        op.execute("DROP INDEX IF EXISTS ix_subscriptions_user_id")
        op.drop_table('subscriptions')


def downgrade() -> None:
    op.create_table(
        'subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan', sa.String(length=50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('starts_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_subscriptions_user_id', 'subscriptions', ['user_id'])
    op.create_index('ix_subscriptions_active', 'subscriptions', ['is_active', 'expires_at'])

    if _table_exists('billing_plans'):
        op.execute("UPDATE billing_plans SET code = 'basic' WHERE code = 'admin'")
        op.execute("UPDATE billing_plans SET code = 'pro' WHERE code = 'admin_pro'")
