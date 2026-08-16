from typing import Optional

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

        imported = await cls._link_imported_user(session=session, user_data=user_data)
        if imported:
            return imported

        stmt_insert = (
            insert(cls.model)
            .values(role='user', **user_data.model_dump())
            .returning(cls.model)
        )
        user = (await session.execute(stmt_insert)).scalar_one_or_none()
        return user

    @classmethod
    async def _link_imported_user(cls, session, user_data: SUserData) -> Optional[User]:
        """Привязать вход к аккаунту из перенесённой базы по Telegram-нику.

        В перенесённой базе хранится только текстовый @ник, поэтому по
        числовому telegram_id человек не находится и без этой связки получил
        бы новый пустой аккаунт вместо своей анкеты.

        Условия привязки — в `find_importable_user_by_telegram`: ник это
        контактное поле, которое может указать кто угодно, поэтому по нику
        пускаем только в запись, в которую никто ещё не входил.
        """
        from users.services.authentication.types.email_auth import (
            find_importable_user_by_telegram,
        )

        if not user_data.telegram_username:
            return None

        user = await find_importable_user_by_telegram(session, user_data.telegram_username)
        if not user:
            return None

        user.telegram_id = user_data.telegram_id
        # Telegram проверил владение аккаунтом подписью initData — аккаунт из
        # переноса можно активировать, иначе закрытые разделы будут недоступны.
        user.is_active = True
        if not user.first_name and user_data.first_name:
            user.first_name = user_data.first_name
        if not user.last_name and user_data.last_name:
            user.last_name = user_data.last_name
        if not user.photo_url and user_data.photo_url:
            user.photo_url = user_data.photo_url

        # telegram_username уникален: занимаем его только если он свободен.
        username_taken = (await session.execute(
            select(cls.model.id).where(
                cls.model.telegram_username == user_data.telegram_username,
                cls.model.id != user.id,
            )
        )).scalar_one_or_none()
        if not username_taken:
            user.telegram_username = user_data.telegram_username

        session.add(user)
        await session.flush()
        return user
