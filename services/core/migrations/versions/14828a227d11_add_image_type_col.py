"""add image_type col

Revision ID: 14828a227d11
Revises: 084afa401837
Create Date: 2025-07-14 22:21:25.146377

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from profiles.enums import ImageType


# revision identifiers, used by Alembic.
revision: str = '14828a227d11'
down_revision: Union[str, None] = '084afa401837'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

image_type_enum = sa.Enum(ImageType, name="image_type")

def upgrade():
    # Сначала создать тип ENUM
    image_type_enum.create(op.get_bind(), checkfirst=True)

    # Затем уже использовать в колонке
    op.add_column(
        'profile_images',
        sa.Column('image_type', image_type_enum, nullable=False, server_default=sa.text("'other'"))
    )

def downgrade():
    op.drop_column('profile_images', 'image_type')
    image_type_enum.drop(op.get_bind(), checkfirst=True)
