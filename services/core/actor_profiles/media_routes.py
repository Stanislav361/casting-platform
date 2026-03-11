"""
Media Assets Routes — загрузка и управление медиа.
"""
from fastapi import APIRouter, Depends, UploadFile, HTTPException, status
from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import tma_authorized, admin_authorized
from actor_profiles.media_service import MediaAssetService
from actor_profiles.schemas import SMediaAsset
from actor_profiles.repository import ActorProfileRepository


media_service = MediaAssetService()


class MediaAssetUserRouter:
    """Роуты для пользователя — управление своими медиа."""

    def __init__(self):
        self.router = APIRouter(tags=["media-assets"], prefix="/actor-profiles")
        self.include_routers()

    def include_routers(self):
        self.add_upload_photo()
        self.add_upload_video()
        self.add_delete_media()
        self.add_set_primary()

    def add_upload_photo(self):
        @self.router.post("/{profile_id}/media/photo/", response_model=SMediaAsset)
        async def upload_photo(
            profile_id: int,
            file: UploadFile,
            authorized: JWT = Depends(tma_authorized),
        ) -> SMediaAsset:
            """Загрузка фото (автоматический ресайз и thumbnail)."""
            user_id = int(authorized.id)

            # Проверяем ownership
            is_owner = await ActorProfileRepository.check_profile_ownership(
                profile_id=profile_id, user_id=user_id,
            )
            if not is_owner:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Profile does not belong to you"},
                )

            asset = await media_service.upload_photo(
                actor_profile_id=profile_id,
                file=file,
                user_id=user_id,
            )
            return SMediaAsset.model_validate(asset)

    def add_upload_video(self):
        @self.router.post("/{profile_id}/media/video/", response_model=SMediaAsset)
        async def upload_video(
            profile_id: int,
            file: UploadFile,
            authorized: JWT = Depends(tma_authorized),
        ) -> SMediaAsset:
            """Загрузка видео (автоматическое транскодирование)."""
            user_id = int(authorized.id)

            is_owner = await ActorProfileRepository.check_profile_ownership(
                profile_id=profile_id, user_id=user_id,
            )
            if not is_owner:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Profile does not belong to you"},
                )

            asset = await media_service.upload_video(
                actor_profile_id=profile_id,
                file=file,
                user_id=user_id,
            )
            return SMediaAsset.model_validate(asset)

    def add_delete_media(self):
        @self.router.delete("/{profile_id}/media/{asset_id}/")
        async def delete_media(
            profile_id: int,
            asset_id: int,
            authorized: JWT = Depends(tma_authorized),
        ) -> int:
            """Удалить медиа-ассет."""
            user_id = int(authorized.id)

            is_owner = await ActorProfileRepository.check_profile_ownership(
                profile_id=profile_id, user_id=user_id,
            )
            if not is_owner:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Profile does not belong to you"},
                )

            await MediaAssetService.delete_media_asset(
                asset_id=asset_id,
                actor_profile_id=profile_id,
            )
            return status.HTTP_200_OK

    def add_set_primary(self):
        @self.router.patch("/{profile_id}/media/{asset_id}/primary/")
        async def set_primary(
            profile_id: int,
            asset_id: int,
            authorized: JWT = Depends(tma_authorized),
        ) -> int:
            """Установить медиа как основное фото."""
            user_id = int(authorized.id)

            is_owner = await ActorProfileRepository.check_profile_ownership(
                profile_id=profile_id, user_id=user_id,
            )
            if not is_owner:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Profile does not belong to you"},
                )

            await MediaAssetService.set_primary(
                asset_id=asset_id,
                actor_profile_id=profile_id,
            )
            return status.HTTP_200_OK


