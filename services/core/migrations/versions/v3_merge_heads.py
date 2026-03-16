"""Merge v2_0_transform and v3_verification_tickets heads

Revision ID: v3_merge_heads
Revises: v3_verification_tickets, v2_0_transform
"""
from typing import Sequence, Union

revision: str = 'v3_merge_heads'
down_revision: Union[str, Sequence[str]] = ('v3_verification_tickets', 'v2_0_transform')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
