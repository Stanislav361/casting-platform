"""
Actor Profile Routes — CRUD для профилей актёров.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, status
from typing import Optional

from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import admin_authorized, tma_authorized
from users.enums import DeleteType
from actor_profiles.service import ActorProfileService
from actor_profiles.schemas import (
    SActorProfileCreate,
    SActorProfileUpdate,
    SActorProfileData,
    SActorProfileList,
    SActorProfileSwitchList,
)
from security.rate_limit import rate_limit_dependency
from rbac.decorators import require_permission
from rbac.permissions import Permission


class ActorProfileUserRouter:
    """Роуты для актёра (user) — управление своими профилями."""

    def __init__(self):
        self.router = APIRouter(tags=["actor-profiles"], prefix="/actor-profiles")
        self.include_routers()

    def include_routers(self):
        self.add_create_profile()
        self.add_get_my_profiles()
        self.add_get_profile()
        self.add_update_profile()

    def add_create_profile(self):
        @self.router.post("/", response_model=SActorProfileData)
        async def create_profile(
            data: SActorProfileCreate,
            authorized: JWT = Depends(tma_authorized),
        ) -> SActorProfileData:
            """Создать новый профиль актёра."""
            return await ActorProfileService.create_profile(
                user_token=authorized,
                data=data,
            )

    def add_get_my_profiles(self):
        @self.router.get("/my/", response_model=SActorProfileSwitchList)
        async def get_my_profiles(
            authorized: JWT = Depends(tma_authorized),
        ) -> SActorProfileSwitchList:
            """Получить все мои профили (для Switch Profile UI)."""
            return await ActorProfileService.get_my_profiles(user_token=authorized)

    def add_get_profile(self):
        @self.router.get("/{profile_id}/", response_model=SActorProfileData)
        async def get_profile(
            profile_id: int,
            authorized: JWT = Depends(tma_authorized),
        ) -> SActorProfileData:
            """Получить конкретный профиль."""
            return await ActorProfileService.get_profile(
                profile_id=profile_id,
                user_token=authorized,
            )

    def add_update_profile(self):
        @self.router.patch("/{profile_id}/", response_model=SActorProfileData)
        async def update_profile(
            profile_id: int,
            data: SActorProfileUpdate,
            authorized: JWT = Depends(tma_authorized),
        ) -> SActorProfileData:
            """Обновить профиль актёра."""
            return await ActorProfileService.update_profile(
                profile_id=profile_id,
                data=data,
                user_token=authorized,
            )


class ActorProfileAdminRouter:
    """Роуты для администратора — управление профилями актёров."""

    def __init__(self):
        self.router = APIRouter(tags=["admin-actor-profiles"], prefix="/actor-profiles")
        self.include_routers()

    def include_routers(self):
        self.add_get_profiles_list()
        self.add_get_profile()
        self.add_update_profile()
        self.add_soft_delete_profile()
        self.add_hard_delete_profile()

    def add_get_profiles_list(self):
        @self.router.get("/", response_model=SActorProfileList)
        async def get_profiles_list(
            search: Optional[str] = Query(None),
            page_size: int = Query(20, gt=0),
            page_number: int = Query(1, gt=0),
            authorized: JWT = Depends(admin_authorized),
        ) -> SActorProfileList:
            """Список всех профилей актёров (с пагинацией и поиском)."""
            return await ActorProfileService.get_profiles_list(
                page_number=page_number,
                page_size=page_size,
                search=search,
            )

    def add_get_profile(self):
        @self.router.get("/{profile_id}/", response_model=SActorProfileData)
        async def get_profile(
            profile_id: int,
            authorized: JWT = Depends(admin_authorized),
        ) -> SActorProfileData:
            """Получить профиль актёра (с internal полями)."""
            return await ActorProfileService.get_profile(
                profile_id=profile_id,
                user_token=authorized,
            )

    def add_update_profile(self):
        @self.router.patch("/{profile_id}/")
        async def update_profile(
            profile_id: int,
            data: SActorProfileUpdate,
            authorized: JWT = Depends(admin_authorized),
        ) -> SActorProfileData:
            """Обновить профиль актёра (admin)."""
            return await ActorProfileService.update_profile(
                profile_id=profile_id,
                data=data,
                user_token=authorized,
            )

    def add_soft_delete_profile(self):
        @self.router.delete("/{profile_id}/soft/")
        async def soft_delete_profile(
            profile_id: int,
            authorized: JWT = Depends(admin_authorized),
        ) -> int:
            """Мягкое удаление профиля (Manager+)."""
            return await ActorProfileService.delete_profile(
                profile_id=profile_id,
                user_token=authorized,
                delete_type=DeleteType.SOFT,
            )

    def add_hard_delete_profile(self):
        @self.router.delete("/{profile_id}/hard/")
        async def hard_delete_profile(
            profile_id: int,
            authorized: JWT = Depends(admin_authorized),
        ) -> int:
            """Жёсткое удаление профиля (только Owner)."""
            return await ActorProfileService.delete_profile(
                profile_id=profile_id,
                user_token=authorized,
                delete_type=DeleteType.HARD,
            )


