from wsgiref.util import request_uri

from users.enums import ModelRoles
from users.repositories.base import BaseUserRepository
from users.schemas.auth import SUserData
from users.models import User
from postgres.database import transaction
from sqlalchemy import select, update, insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from users.exceptions import UserException

class TmaUserRepository(BaseUserRepository):

    dev_auth_type = ModelRoles.user

    @classmethod
    @transaction
    async def add_or_get(cls, session, user_data: SUserData) -> User:
        stmt_get = select(cls.model).filter_by(telegram_id=user_data.telegram_id)
        user = (await session.execute(stmt_get)).scalar_one_or_none()
        if user:
            return user
        stmt_insert = (
            insert(cls.model)
            .values(role='user', **user_data.model_dump())
            .returning(cls.model)
        )
        user = (await session.execute(stmt_insert)).scalar_one_or_none()
        return user
