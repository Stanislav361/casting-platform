"""v3: OAuth Providers — мультипровайдерная авторизация

- Создать таблицу user_oauth_providers
- Уникальный индекс на (provider, provider_user_id)

Revision ID: v3_oauth_providers
Revises: a08ff9544e3f
Create Date: 2026-02-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'v3_oauth_providers'
down_revision: Union[str, None] = 'a08ff9544e3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'user_oauth_providers',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('provider_user_id', sa.String(length=255), nullable=False),
        sa.Column('provider_username', sa.String(length=255), nullable=True),
        sa.Column('provider_email', sa.String(length=255), nullable=True),
        sa.Column('provider_avatar', sa.String(length=500), nullable=True),
        sa.Column('access_token', sa.String(length=1000), nullable=True),
        sa.Column('refresh_token', sa.String(length=1000), nullable=True),
        sa.Column('token_expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('raw_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_oauth_provider_user_id', 'user_oauth_providers', ['user_id'])
    op.create_index('ix_oauth_provider_unique', 'user_oauth_providers', ['provider', 'provider_user_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_oauth_provider_unique', table_name='user_oauth_providers')
    op.drop_index('ix_oauth_provider_user_id', table_name='user_oauth_providers')
    op.drop_table('user_oauth_providers')
