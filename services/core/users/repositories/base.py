from sqlalchemy import select, insert, update
from users.models import User, AuthPredicate
from postgres.database import transaction
from pydantic import BaseModel
from users.exceptions import UserException
from sqlalchemy.exc import IntegrityError
from shared.repository.base.repository import BaseRepository
from typing import Optional
from users.enums import ModelRoles


class BaseUserRepository(BaseRepository):
    model = User
    dev_auth_type = None

    @classmethod
    @transaction
    async def find_one_or_none(cls, session, **data) -> User:
        query = select(cls.model).filter_by(**data)
        result = await session.execute(query)
        return result.unique().scalar_one_or_none()

    @classmethod
    @transaction
    async def get_user_with_target_role(cls, session, telegram_username: str, roles: list[ModelRoles]) -> Optional[User]:
        stmt = (
            select(cls.model)
            .filter_by(telegram_username=telegram_username)
            .filter(cls.model.role.in_([role.value for role in roles]))
        )
        user = (await session.execute(stmt)).scalar_one_or_none()
        return user

    @classmethod
    @transaction
    async def add(cls, session, user_data: BaseModel) -> User:
        try:
            query = insert(cls.model).values(**user_data.model_dump()).returning(cls.model)
            result = await session.execute(query)
            return result.scalars().first()
        except IntegrityError as e:
            if 'users_telegram_id_key' in str(e.orig):
                raise UserException.get_tg_id_already_exist_exc(tg_id=user_data.telegram_id)
            if 'users_telegram_username_key' in str(e.orig):
                raise UserException.get_tg_username_already_exist_exc(tg_username=user_data.telegram_username)
            if 'users_email_key' in str(e.orig):
                raise UserException.get_email_already_exist_exc(email=user_data.email)
            raise e

    @classmethod
    @transaction
    async def auth_predicate(cls, session) -> bool:
        stmt = select(AuthPredicate).filter_by(type=cls.dev_auth_type)
        predicate = (await session.execute(stmt)).unique().scalar_one_or_none()
        return predicate.auth_predicate

    @classmethod
    @transaction
    async def set_auth_predicate(cls, session, predicate: bool) -> None:
        stmt = (update(AuthPredicate)
                .where(AuthPredicate.type == cls.dev_auth_type)
                .values(auth_predicate=predicate)
                )
        await session.execute(stmt)
