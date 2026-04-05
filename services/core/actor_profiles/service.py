"""
Actor Profile Service — бизнес-логика.
"""
import math
from typing import Optional, List
from fastapi import HTTPException, status

from actor_profiles.repository import ActorProfileRepository
from actor_profiles.schemas import (
    SActorProfileCreate,
    SActorProfileUpdate,
    SActorProfileData,
    SActorProfileList,
    SActorProfileListItem,
    SActorProfileSwitchList,
    SMediaAsset,
)
from users.services.auth_token.types.jwt import JWT
from users.enums import Roles, DeleteType
from shared.schemas.base import SListMeta
from postgres.database import async_session_maker


class ActorProfileService:

    @classmethod
    async def create_profile(cls, user_token: JWT, data: SActorProfileCreate) -> SActorProfileData:
        """Создать новый профиль актёра для текущего пользователя."""
        user_id = int(user_token.id)
        profile = await ActorProfileRepository.create_profile(
            user_id=user_id,
            data=data.model_dump(exclude_none=True),
        )
        return SActorProfileData.model_validate(profile)

    @classmethod
    async def get_profile(cls, profile_id: int, user_token: Optional[JWT] = None) -> SActorProfileData:
        """Получить профиль по ID.
        - Контакты скрыты если пользователь забанен.
        - Если владелец — агент, показываем контакты агента вместо профильных.
        """
        profile = await ActorProfileRepository.get_profile_by_id(profile_id=profile_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Actor profile not found"}
            )
        data = SActorProfileData.model_validate(profile)

        is_own = user_token and int(user_token.id) == profile.user_id
        from users.models import User
        async with async_session_maker() as session:
            owner = await session.get(User, profile.user_id)
            if owner:
                if not owner.is_active:
                    data.phone_number = None
                    data.email = None
                elif owner.role and str(owner.role.value if hasattr(owner.role, 'value') else owner.role) == 'agent':
                    # Контакты актёра-клиента агента заменяем на контакты самого агента
                    name_parts = [p for p in [owner.first_name, owner.last_name] if p]
                    data.has_agent = True
                    data.agent_name = " ".join(name_parts) if name_parts else (owner.email or "Агент")
                    data.phone_number = owner.phone_number
                    data.email = owner.email

        return data

    @classmethod
    async def get_my_profiles(cls, user_token: JWT) -> SActorProfileSwitchList:
        """
        Получить все профили текущего пользователя.
        Используется для Switch Profile UI.
        """
        user_id = int(user_token.id)
        current_profile_id = int(user_token.profile_id) if user_token.profile_id else None

        profiles = await ActorProfileRepository.get_profiles_by_user(user_id=user_id)

        profile_items = []
        for p in profiles:
            primary_photo = None
            all_photos = [m for m in (p.media_assets or []) if m.file_type == 'photo']
            if all_photos:
                primary_assets = [m for m in all_photos if m.is_primary]
                if primary_assets:
                    primary_photo = primary_assets[0].processed_url or primary_assets[0].original_url
                else:
                    primary_photo = all_photos[0].processed_url or all_photos[0].original_url

            photo_categories = {m.photo_category for m in all_photos if m.photo_category}
            has_required = {'portrait', 'profile', 'full_height'}.issubset(photo_categories)

            profile_items.append(SActorProfileListItem(
                id=p.id,
                display_name=p.display_name,
                first_name=p.first_name,
                last_name=p.last_name,
                gender=p.gender,
                city=p.city,
                qualification=p.qualification,
                is_active=p.is_active,
                primary_photo=primary_photo,
                photo_count=len(all_photos),
                has_required_photos=has_required,
            ))

        return SActorProfileSwitchList(
            profiles=profile_items,
            current_profile_id=current_profile_id,
        )

    @classmethod
    async def update_profile(
        cls,
        profile_id: int,
        data: SActorProfileUpdate,
        user_token: JWT,
    ) -> SActorProfileData:
        """Обновить профиль актёра."""
        user_id = int(user_token.id)
        user_role = Roles(user_token.role)

        # Проверяем ownership или роль
        is_owner = await ActorProfileRepository.check_profile_ownership(
            profile_id=profile_id, user_id=user_id,
        )
        if not is_owner and not user_role.can_manage_castings:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"message": "You don't have permission to edit this profile"}
            )

        profile = await ActorProfileRepository.update_profile(
            profile_id=profile_id,
            data=data.model_dump(exclude_none=True),
        )
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Actor profile not found"}
            )
        return SActorProfileData.model_validate(profile)

    @classmethod
    async def delete_profile(
        cls,
        profile_id: int,
        user_token: JWT,
        delete_type: DeleteType = DeleteType.SOFT,
    ) -> int:
        """
        Удалить профиль.
        SOFT_DELETE — для Manager и выше.
        HARD_DELETE — только для Owner.
        """
        user_role = Roles(user_token.role)

        if delete_type == DeleteType.HARD:
            if not user_role.can_hard_delete:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Only Owner can perform hard delete"}
                )
            await ActorProfileRepository.hard_delete_profile(profile_id=profile_id)
        else:
            if not user_role.can_soft_delete:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Insufficient permissions for delete"}
                )
            await ActorProfileRepository.soft_delete_profile(profile_id=profile_id)

        return status.HTTP_200_OK

    @classmethod
    async def get_profiles_list(
        cls,
        page_number: int,
        page_size: int,
        search: Optional[str] = None,
    ) -> SActorProfileList:
        """Список профилей с пагинацией (для admin)."""
        profiles, query = await ActorProfileRepository.get_profiles_paginated(
            page_number=page_number,
            page_size=page_size,
            search=search,
        )

        async with async_session_maker() as session:
            meta = await ActorProfileRepository.get_meta(
                session=session,
                query=query,
                page_number=page_number,
                page_size=page_size,
            )

        profile_items = []
        for p in profiles:
            primary_photo = None
            all_photos = [m for m in (p.media_assets or []) if m.file_type == 'photo']
            primary = [m for m in all_photos if m.is_primary]
            if primary:
                primary_photo = primary[0].processed_url or primary[0].original_url
            elif all_photos:
                primary_photo = all_photos[0].processed_url or all_photos[0].original_url

            photo_categories = {m.photo_category for m in all_photos if m.photo_category}
            has_required = {'portrait', 'profile', 'full_height'}.issubset(photo_categories)

            profile_items.append(SActorProfileListItem(
                id=p.id,
                display_name=p.display_name,
                first_name=p.first_name,
                last_name=p.last_name,
                gender=p.gender,
                city=p.city,
                qualification=p.qualification,
                is_active=p.is_active,
                primary_photo=primary_photo,
                photo_count=len(all_photos),
                has_required_photos=has_required,
            ))

        return SActorProfileList(
            meta=SListMeta(**meta),
            profiles=profile_items,
        )


