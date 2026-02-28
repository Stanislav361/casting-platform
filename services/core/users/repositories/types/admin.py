from users.repositories.base import BaseUserRepository
from users.schemas.admin import CurrentAdminData, SUserList, SUserFilters
from users.exceptions import UserException
from users.enums import ModelRoles, SearchFields
from sqlalchemy.ext.asyncio import AsyncSession
from users.schemas.auth import SUpdateAdminDataAfterAuth, SAdminData, SAdminAuthData
from postgres.database import transaction
from typing import List, Tuple, Dict, Optional, Sequence
from users.models import User
from sqlalchemy import select, update, func, delete, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
import math
from sqlalchemy.sql.selectable import Select


class AdminUserRepository(BaseUserRepository):

    dev_auth_type = ModelRoles.administrator

    @classmethod
    @transaction
    async def get_current_user(cls, session, user_id: int, ) -> User:
        user = await super().find_one_or_none(session=session, id=int(user_id))
        return user

    @classmethod
    async def get_user_list(
            cls,
            session: AsyncSession,
            filters: SUserFilters,
            page_size: int,
            page_number: int,
            search: Optional[str] = None
    )-> Tuple[Sequence[Optional[User]], Select]:

        stmt = (
            select(cls.model)
            .filter_by(**filters.model_dump(exclude_none=True))
            .order_by(cls.model.created_at.desc())
        )

        if search:
            search_conditions = [
                getattr(User, field.value).ilike(f"%{search}%") for field in SearchFields
            ]
            stmt = stmt.where(or_(*search_conditions))

        stmt_paginate = stmt.offset((page_number - 1) * page_size).limit(page_size)

        response = (await session.execute(stmt_paginate)).scalars().all()

        return response, stmt

    @classmethod
    @transaction
    async def _get_total_rows(cls, session, query) -> int:
        sub_query = query.subquery()
        stmt_count = select(func.count()).select_from(sub_query)
        return (await session.execute(stmt_count)).scalar_one()

    @classmethod
    @transaction
    async def set_user_roles(cls, session, user_id: int, role: ModelRoles) -> None:
        stmt = update(cls.model).where(cls.model.id == user_id).values(role=role)
        await session.execute(stmt)

    @classmethod
    @transaction
    async def update_user_info(cls, session, user_id, update_data: SUpdateAdminDataAfterAuth):
        try:
            stmt_update = (
                update(cls.model)
                .where(cls.model.id == user_id)
                .values(**update_data.model_dump())
                .returning(cls.model)
            )
            await session.execute(stmt_update)
        except IntegrityError as e:
            if 'users_telegram_id_key' in str(e.orig):
                raise UserException.get_tg_id_already_exist_exc(tg_id=update_data.telegram_id)
            if 'users_telegram_username_key' in str(e.orig):
                raise UserException.get_tg_username_already_exist_exc(tg_username=update_data.telegram_id)
            raise
