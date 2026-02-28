"""Season 03-04: Billing, CRM, Notifications, Blacklist, ActionLog

Revision ID: v3_v4_full
Revises: v3_employer_pro_subs
Create Date: 2026-02-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v3_v4_full'
down_revision: Union[str, None] = 'v3_employer_pro_subs'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 3.1 Billing Plans
    op.create_table(
        'billing_plans',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('code', sa.String(50), unique=True, nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('price_monthly', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('price_yearly', sa.Numeric(10, 2), nullable=True),
        sa.Column('max_projects', sa.Integer(), nullable=True),
        sa.Column('can_search_all_actors', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('can_fulltext_search', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('can_create_shortlists', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Seed billing plans
    op.execute("""
        INSERT INTO billing_plans (code, name, description, price_monthly, max_projects, can_search_all_actors, can_fulltext_search, can_create_shortlists) VALUES
        ('basic', 'Админ (Basic)', 'Публикация кастингов, работа с откликнувшимися актёрами', 990, 10, false, false, false),
        ('pro', 'Админ PRO', 'Полный доступ: все актёры, полнотекстовый поиск, шорт-листы', 2990, NULL, true, true, true)
    """)

    # 3.2 User Subscriptions (extended)
    op.create_table(
        'user_subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_id', sa.Integer(), sa.ForeignKey('billing_plans.id'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('starts_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('grace_until', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('auto_renew', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_user_subscriptions_user', 'user_subscriptions', ['user_id'])

    # 4.1 Notifications
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('channel', sa.String(20), nullable=False, server_default='in_app'),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('related_casting_id', sa.Integer(), sa.ForeignKey('castings.id', ondelete='SET NULL'), nullable=True),
        sa.Column('related_profile_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_notifications_user_unread', 'notifications', ['user_id', 'is_read'])

    # 4.2 Trust Score Logs
    op.create_table(
        'trust_score_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('profile_id', sa.Integer(), sa.ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('event_type', sa.String(50), nullable=False),
        sa.Column('points', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('description', sa.String(300), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_trust_score_profile', 'trust_score_logs', ['profile_id'])

    # 4.3 Blacklist
    op.create_table(
        'blacklist',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ban_type', sa.String(20), nullable=False),
        sa.Column('reason_log', sa.Text(), nullable=False),
        sa.Column('banned_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('starts_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_blacklist_user_active', 'blacklist', ['user_id', 'is_active'])

    # 4.4 Action Logs (micro-chat)
    op.create_table(
        'action_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('casting_id', sa.Integer(), sa.ForeignKey('castings.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action_type', sa.String(50), nullable=False),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('tagged_user_ids', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_action_logs_casting', 'action_logs', ['casting_id', 'created_at'])


def downgrade() -> None:
    op.drop_table('action_logs')
    op.drop_table('blacklist')
    op.drop_table('trust_score_logs')
    op.drop_table('notifications')
    op.drop_table('user_subscriptions')
    op.drop_table('billing_plans')
