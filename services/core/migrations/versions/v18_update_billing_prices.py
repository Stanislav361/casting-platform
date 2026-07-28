"""v18: update billing plan prices to final approved tariffs

Финальные цены, согласованные с заказчиком (см. Публичную оферту):
  - 'admin'     («Админ»)      — 1690 руб./мес. (было 990 руб./мес.)
  - 'admin_pro' («Админ PRO»)  — 3690 руб./мес. (было 2990 руб./мес.)

Также очищено название тарифа 'admin' от устаревшей пометки "(Basic)",
оставшейся от старой терминологии до унификации биллинга (см. v17).

Revision ID: v18_update_billing_prices
Revises: v17_unify_billing_subscriptions
Create Date: 2026-07-28
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'v18_update_billing_prices'
down_revision: Union[str, None] = 'v17_unify_billing_subscriptions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    from sqlalchemy import inspect
    bind = op.get_bind()
    insp = inspect(bind)
    return table in insp.get_table_names()


def upgrade() -> None:
    if not _table_exists('billing_plans'):
        return

    op.execute(
        "UPDATE billing_plans SET price_monthly = 1690, name = 'Админ' WHERE code = 'admin'"
    )
    op.execute(
        "UPDATE billing_plans SET price_monthly = 3690, name = 'Админ PRO' WHERE code = 'admin_pro'"
    )


def downgrade() -> None:
    if not _table_exists('billing_plans'):
        return

    op.execute(
        "UPDATE billing_plans SET price_monthly = 990, name = 'Админ (Basic)' WHERE code = 'admin'"
    )
    op.execute(
        "UPDATE billing_plans SET price_monthly = 2990, name = 'Админ PRO' WHERE code = 'admin_pro'"
    )
