"""set cities values

Revision ID: 29fa918a30c4
Revises: a439c5c5331f
Create Date: 2025-07-15 03:45:36.038318

"""
from typing import Sequence, Union
from os.path import dirname, abspath
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29fa918a30c4'
down_revision: Union[str, None] = 'a439c5c5331f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



file_path = f'{dirname(dirname(abspath(__file__)))}/cities.txt'


def get_data(file):
    with open(file, mode='r', encoding='utf-8') as f:
        reader = []
        for line in f.readlines():
            name, region = line.strip().split(',')
            full_name = ', '.join([name, region])
            reader.append((name, region, full_name))
    return reader


cities = get_data(file_path)

def upgrade() -> None:
    for name, region, full_name in cities:
        op.execute(
            sa.text("INSERT INTO cities (name, region, full_name) VALUES (:name, :region, :full_name)")
            .bindparams(name=name, region=region, full_name=full_name)
        )

def downgrade() -> None:
    for name, region, full_name in cities:
        op.execute(
            sa.text("DELETE FROM cities WHERE name = :name AND region = :region").bindparams(name=name, region=region)
        )

