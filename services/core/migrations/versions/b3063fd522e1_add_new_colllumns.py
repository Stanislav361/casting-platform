"""add new colllumns

Revision ID: b3063fd522e1
Revises: 40f1f03382e1
Create Date: 2025-07-14 16:42:20.364068

"""

# revision identifiers, used by Alembic.
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b3063fd522e1"
down_revision: Union[str, None] = "40f1f03382e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# ----------  ENUM definitions  ----------
qualification_enum = sa.Enum(
    "professional",
    "skilled",
    "enthusiast",
    "beginner",
    "other",
    name="qualification",
)

looktype_enum = sa.Enum(
    "asian",
    "middle_eastern",
    "african",
    "jewish",
    "european",
    "south_asian",
    "caucasian",
    "latino",
    "mixed",
    "biracial",
    "slavic",
    "other",
    name="looktype",
)

haircolor_enum = sa.Enum(
    "blonde",
    "brunette",
    "brown",
    "light_brown",
    "red",
    "gray",
    "other",
    name="haircolor",
)

hairlength_enum = sa.Enum(
    "short",
    "medium",
    "long",
    "bald",
    name="hairlength",
)
# ----------------------------------------

def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    # 1. Создаём типы (если ещё нет)
    qualification_enum.create(bind, checkfirst=True)
    looktype_enum.create(bind, checkfirst=True)
    haircolor_enum.create(bind, checkfirst=True)
    hairlength_enum.create(bind, checkfirst=True)

    # 2. Остальные изменения
    op.create_unique_constraint(
        "uq_auth_predicates_id",  # лучше дать имя, чем None
        "auth_predicates",
        ["id"],
    )

    op.add_column("profiles", sa.Column("qualification", qualification_enum, nullable=True))
    op.add_column("profiles", sa.Column("look_type", looktype_enum, nullable=True))
    op.add_column("profiles", sa.Column("hair_color", haircolor_enum, nullable=True))
    op.add_column("profiles", sa.Column("hair_length", hairlength_enum, nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()

    # 1. Удаляем столбцы / ограничения
    op.drop_column("profiles", "hair_length")
    op.drop_column("profiles", "hair_color")
    op.drop_column("profiles", "look_type")
    op.drop_column("profiles", "qualification")
    op.drop_constraint("uq_auth_predicates_id", "auth_predicates", type_="unique")

    # 2. Удаляем типы (если больше не используются)
    hairlength_enum.drop(bind, checkfirst=True)
    haircolor_enum.drop(bind, checkfirst=True)
    looktype_enum.drop(bind, checkfirst=True)
    qualification_enum.drop(bind, checkfirst=True)
