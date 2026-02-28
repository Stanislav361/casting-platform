from postgres.database import Base
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from users.services.authorization.exceptions import UserForbidden
from errors import NotFound
from typing import TypeVar, Type

TABLE = TypeVar('TABLE', bound=Base)

async def check_parent_permissions_on_child(
        session: AsyncSession,
        parent_id: int,
        child_model: Type[TABLE],
        child_id: int,
) -> None:

    stmt = (
        select(child_model).filter_by(id=child_id)
    )
    child = (await session.execute(stmt)).unique().scalar_one_or_none()
    if not child:
        raise NotFound
    if child.parent_id != parent_id:
        raise UserForbidden
