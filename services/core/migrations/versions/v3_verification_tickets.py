"""Verification tickets, ticket messages, and general chat messages

Revision ID: v3_verification_tickets
Revises: v3_employer_verified
"""
from alembic import op
import sqlalchemy as sa

revision = 'v3_verification_tickets'
down_revision = 'v3_employer_verified'
branch_labels = None
depends_on = None


def _table_exists(table):
    from sqlalchemy import inspect, create_engine
    from config import settings
    eng = create_engine(settings.SYNC_DATABASE_URL)
    exists = inspect(eng).has_table(table)
    eng.dispose()
    return exists


def upgrade() -> None:
    if not _table_exists('verification_tickets'):
        op.create_table(
            'verification_tickets',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='open'),
            sa.Column('company_name', sa.String(length=200), nullable=True),
            sa.Column('about_text', sa.Text(), nullable=True),
            sa.Column('projects_text', sa.Text(), nullable=True),
            sa.Column('experience_text', sa.Text(), nullable=True),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        try:
            op.create_index('ix_verification_tickets_user_id', 'verification_tickets', ['user_id'])
        except Exception:
            pass

    if not _table_exists('ticket_messages'):
        op.create_table(
            'ticket_messages',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('ticket_id', sa.Integer(), sa.ForeignKey('verification_tickets.id', ondelete='CASCADE'), nullable=False),
            sa.Column('sender_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        try:
            op.create_index('ix_ticket_messages_ticket_id', 'ticket_messages', ['ticket_id'])
        except Exception:
            pass

    if not _table_exists('general_chat_messages'):
        op.create_table(
            'general_chat_messages',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('sender_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )


def downgrade() -> None:
    op.drop_table('general_chat_messages')
    try:
        op.drop_index('ix_ticket_messages_ticket_id', table_name='ticket_messages')
    except Exception:
        pass
    op.drop_table('ticket_messages')
    try:
        op.drop_index('ix_verification_tickets_user_id', table_name='verification_tickets')
    except Exception:
        pass
    op.drop_table('verification_tickets')
