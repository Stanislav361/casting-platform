"""v2.0 Casting Platform Transformation

- Add email, password_hash, is_deleted to users
- Add owner/manager roles to ModelRoles enum
- Create actor_profiles (multi-profile)
- Create media_assets
- Create otp_codes
- Create shortlist_tokens
- Add RBAC support fields

Revision ID: v2_0_transform
Revises: d2148964e776
Create Date: 2026-02-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = 'v2_0_transform'
down_revision: Union[str, None] = 'd2148964e776'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ─── 1. Расширяем enum ModelRoles ───
    op.execute("ALTER TYPE modelroles ADD VALUE IF NOT EXISTS 'owner'")
    op.execute("ALTER TYPE modelroles ADD VALUE IF NOT EXISTS 'manager'")

    # ─── 2. Обновляем таблицу users ───
    op.add_column('users', sa.Column('email', sa.String(255), unique=True, nullable=True, index=True))
    op.add_column('users', sa.Column('password_hash', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True))

    op.create_index('ix_users_email_active', 'users', ['email', 'is_active'])
    op.create_index('ix_users_is_deleted', 'users', ['is_deleted'])

    # ─── 3. Создаём actor_profiles (multi-profile) ───
    op.create_table(
        'actor_profiles',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),

        sa.Column('display_name', sa.String(200), nullable=True),
        sa.Column('first_name', sa.String(100), nullable=True),
        sa.Column('last_name', sa.String(100), nullable=True),
        sa.Column('gender', sa.String(20), nullable=True),
        sa.Column('date_of_birth', sa.DateTime(), nullable=True),
        sa.Column('phone_number', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('city', sa.String(200), nullable=True),

        sa.Column('qualification', sa.String(50), nullable=True),
        sa.Column('experience', sa.Integer(), nullable=True),
        sa.Column('about_me', sa.Text(), nullable=True),

        sa.Column('look_type', sa.String(50), nullable=True),
        sa.Column('hair_color', sa.String(50), nullable=True),
        sa.Column('hair_length', sa.String(50), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('clothing_size', sa.String(20), nullable=True),
        sa.Column('shoe_size', sa.String(20), nullable=True),

        sa.Column('bust_volume', sa.Integer(), nullable=True),
        sa.Column('waist_volume', sa.Integer(), nullable=True),
        sa.Column('hip_volume', sa.Integer(), nullable=True),
        sa.Column('video_intro', sa.String(500), nullable=True),

        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.TIMESTAMP(timezone=True), nullable=True),

        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('admin_rating', sa.Integer(), nullable=True),
        sa.Column('trust_score', sa.Integer(), nullable=False, server_default='0'),

        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_actor_profiles_user_active', 'actor_profiles', ['user_id', 'is_active'])

    # ─── 4. Создаём media_assets ───
    op.create_table(
        'media_assets',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('actor_profile_id', sa.Integer(), sa.ForeignKey('actor_profiles.id', ondelete='CASCADE'), nullable=False, index=True),

        sa.Column('file_type', sa.String(20), nullable=False),
        sa.Column('original_url', sa.String(500), nullable=False),
        sa.Column('processed_url', sa.String(500), nullable=True),
        sa.Column('thumbnail_url', sa.String(500), nullable=True),

        sa.Column('original_filename', sa.String(255), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height_px', sa.Integer(), nullable=True),
        sa.Column('duration_sec', sa.Integer(), nullable=True),

        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),

        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ─── 5. Создаём otp_codes ───
    op.create_table(
        'otp_codes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('destination', sa.String(255), nullable=False),
        sa.Column('destination_type', sa.String(20), nullable=False),
        sa.Column('code', sa.String(6), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ─── 6. Создаём shortlist_tokens (SSOT) ───
    op.create_table(
        'shortlist_tokens',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('token', sa.String(64), unique=True, nullable=False, index=True),
        sa.Column('report_id', sa.Integer(), sa.ForeignKey('reports.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('max_views', sa.Integer(), nullable=True),
        sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('shortlist_tokens')
    op.drop_table('otp_codes')
    op.drop_table('media_assets')
    op.drop_table('actor_profiles')

    op.drop_index('ix_users_is_deleted', table_name='users')
    op.drop_index('ix_users_email_active', table_name='users')
    op.drop_column('users', 'deleted_at')
    op.drop_column('users', 'is_deleted')
    op.drop_column('users', 'password_hash')
    op.drop_column('users', 'email')


