"""
Actor Profile Repository — операции с БД.
"""
import math
from typing import Optional, List, Tuple, Sequence
from datetime import datetime, timezone

from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.selectable import Select

from postgres.database import transaction
from users.models import ActorProfile, MediaAsset
from shared.repository.base.repository import BaseRepository


class ActorProfileRepository(BaseRepository):
    model = ActorProfile

    @classmethod
    @transaction
    async def create_profile(cls, session, user_id: int, data: dict) -> ActorProfile:
        """Создать новый профиль актёра."""
        profile = ActorProfile(user_id=user_id, **data)
        session.add(profile)
        await session.flush()
        await session.refresh(profile, attribute_names=['media_assets'])
        return profile

    @classmethod
    @transaction
    async def get_profile_by_id(cls, session, profile_id: int) -> Optional[ActorProfile]:
        """Получить профиль по ID с медиа-ассетами."""
        stmt = (
            select(ActorProfile)
            .filter_by(id=profile_id, is_deleted=False)
            .options(selectinload(ActorProfile.media_assets))
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @classmethod
    @transaction
    async def get_profiles_by_user(cls, session, user_id: int) -> List[ActorProfile]:
        """Все активные профили пользователя."""
        stmt = (
            select(ActorProfile)
            .filter_by(user_id=user_id, is_deleted=False)
            .options(selectinload(ActorProfile.media_assets))
            .order_by(ActorProfile.created_at.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @classmethod
    @transaction
    async def update_profile(cls, session, profile_id: int, data: dict) -> Optional[ActorProfile]:
        """Обновить профиль (PATCH)."""
        # Убираем None значения — обновляем только то, что передано
        update_data = {k: v for k, v in data.items() if v is not None}
        if not update_data:
            return await cls.get_profile_by_id(session=session, profile_id=profile_id)

        stmt = (
            update(ActorProfile)
            .where(ActorProfile.id == profile_id, ActorProfile.is_deleted == False)  # noqa
            .values(**update_data)
            .returning(ActorProfile)
        )
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile:
            await session.refresh(profile, attribute_names=['media_assets'])
        return profile

    @classmethod
    @transaction
    async def soft_delete_profile(cls, session, profile_id: int) -> bool:
        """Мягкое удаление (Manager+)."""
        stmt = (
            update(ActorProfile)
            .where(ActorProfile.id == profile_id)
            .values(
                is_deleted=True,
                is_active=False,
                deleted_at=datetime.now(timezone.utc),
            )
        )
        await session.execute(stmt)
        return True

    @classmethod
    @transaction
    async def hard_delete_profile(cls, session, profile_id: int) -> bool:
        """Жёсткое удаление (только Owner)."""
        stmt = delete(ActorProfile).where(ActorProfile.id == profile_id)
        await session.execute(stmt)
        return True

    @classmethod
    @transaction
    async def get_profiles_paginated(
        cls,
        session,
        page_number: int,
        page_size: int,
        search: Optional[str] = None,
    ) -> Tuple[Sequence[ActorProfile], Select]:
        """Получить список профилей с пагинацией и поиском."""
        stmt = (
            select(ActorProfile)
            .filter_by(is_deleted=False)
            .options(selectinload(ActorProfile.media_assets))
            .order_by(ActorProfile.created_at.desc())
        )

        if search:
            from sqlalchemy import or_
            search_conditions = [
                ActorProfile.first_name.ilike(f"%{search}%"),
                ActorProfile.last_name.ilike(f"%{search}%"),
                ActorProfile.display_name.ilike(f"%{search}%"),
                ActorProfile.city.ilike(f"%{search}%"),
            ]
            stmt = stmt.where(or_(*search_conditions))

        stmt_paginated = stmt.offset((page_number - 1) * page_size).limit(page_size)
        result = await session.execute(stmt_paginated)
        profiles = result.scalars().all()

        return profiles, stmt

    @classmethod
    @transaction
    async def check_profile_ownership(cls, session, profile_id: int, user_id: int) -> bool:
        """Проверяет, принадлежит ли профиль пользователю."""
        stmt = select(ActorProfile).filter_by(
            id=profile_id,
            user_id=user_id,
            is_deleted=False,
        )
        result = await session.execute(stmt)
        return result.scalar_one_or_none() is not None


