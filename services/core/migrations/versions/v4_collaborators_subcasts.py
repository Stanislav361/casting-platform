"""Add project_collaborators table and parent_project_id to castings

Revision ID: v4_collaborators_subcasts
Revises: v4_response_status
Create Date: 2026-03-17
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'v4_collaborators_subcasts'
down_revision: Union[str, None] = 'v4_response_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return name in insp.get_table_names()


def _col_exists(table: str, column: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    cols = [c["name"] for c in insp.get_columns(table)]
    return column in cols


def upgrade() -> None:
    if not _table_exists("project_collaborators"):
        op.create_table(
            "project_collaborators",
            sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
            sa.Column("casting_id", sa.Integer, sa.ForeignKey("castings.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("role", sa.String(20), nullable=False, server_default="editor"),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("casting_id", "user_id", name="uq_collab_casting_user"),
        )
        op.create_index("ix_collab_casting", "project_collaborators", ["casting_id"])
        op.create_index("ix_collab_user", "project_collaborators", ["user_id"])

    if not _col_exists("castings", "parent_project_id"):
        op.add_column(
            "castings",
            sa.Column(
                "parent_project_id",
                sa.Integer,
                sa.ForeignKey("castings.id", ondelete="CASCADE"),
                nullable=True,
            ),
        )
        op.create_index("ix_castings_parent_project_id", "castings", ["parent_project_id"])


def downgrade() -> None:
    if _col_exists("castings", "parent_project_id"):
        op.drop_index("ix_castings_parent_project_id", table_name="castings")
        op.drop_column("castings", "parent_project_id")

    if _table_exists("project_collaborators"):
        op.drop_table("project_collaborators")
