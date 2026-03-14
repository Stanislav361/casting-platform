"""
Media Assets Management — загрузка, ресайз фото, транскодирование видео.

Интеграция с S3-compatible хранилищем.
Обработка:
- Фото: Pillow для ресайза и генерации thumbnails
- Видео: ffmpeg (subprocess) для транскодирования
"""
import io
import uuid
import asyncio
import subprocess
import tempfile
import os
from typing import Optional, Tuple
from datetime import datetime, timezone

from fastapi import UploadFile, HTTPException, status
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from postgres.database import transaction
from users.models import ActorProfile, MediaAsset
from shared.services.s3.services.media import S3MediaService
from config import settings

try:
    from PIL import Image
except ImportError:
    Image = None


# ─── Конфигурация обработки медиа ───

PHOTO_MAX_SIZE = (1920, 1920)      # Максимальный размер обработанного фото
THUMBNAIL_SIZE = (300, 300)         # Размер thumbnail
PHOTO_QUALITY = 85                  # JPEG quality
ALLOWED_PHOTO_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/heif', 'image/heic'}
ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'}
MAX_PHOTO_SIZE = 20 * 1024 * 1024   # 20MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB


class PhotoProcessor:
    """Обработка фотографий — ресайз и thumbnail."""

    @staticmethod
    async def process(file_bytes: bytes, mime_type: str) -> Tuple[bytes, bytes, int, int]:
        """
        Обрабатывает фото: ресайз до макс. размера + thumbnail.
        Returns: (processed_bytes, thumbnail_bytes, width, height)
        """
        if Image is None:
            return file_bytes, file_bytes, 0, 0

        def _process():
            img = Image.open(io.BytesIO(file_bytes))

            # Конвертируем HEIF/HEIC
            if img.mode in ('RGBA', 'LA', 'PA'):
                bg = Image.new('RGB', img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = bg
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            original_width, original_height = img.size

            # Ресайз основного фото
            img.thumbnail(PHOTO_MAX_SIZE, Image.LANCZOS)
            processed_buf = io.BytesIO()
            img.save(processed_buf, format='JPEG', quality=PHOTO_QUALITY, optimize=True)
            processed_bytes = processed_buf.getvalue()

            # Thumbnail
            thumb = img.copy()
            thumb.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            thumb_buf = io.BytesIO()
            thumb.save(thumb_buf, format='JPEG', quality=80, optimize=True)
            thumb_bytes = thumb_buf.getvalue()

            return processed_bytes, thumb_bytes, img.width, img.height

        return await asyncio.to_thread(_process)


class VideoProcessor:
    """Обработка видео — транскодирование через ffmpeg."""

    @staticmethod
    async def process(file_bytes: bytes) -> Tuple[bytes, Optional[bytes], int, int, int]:
        """
        Транскодирует видео в MP4 H.264 + генерирует thumbnail.
        Returns: (processed_bytes, thumbnail_bytes, width, height, duration_sec)
        """

        def _process():
            # Сохраняем исходный файл во временную директорию
            with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as input_file:
                input_file.write(file_bytes)
                input_path = input_file.name

            output_path = input_path + '_processed.mp4'
            thumb_path = input_path + '_thumb.jpg'

            try:
                # Получаем информацию о видео
                probe_cmd = [
                    'ffprobe', '-v', 'quiet', '-print_format', 'json',
                    '-show_format', '-show_streams', input_path,
                ]
                try:
                    probe_result = subprocess.run(
                        probe_cmd, capture_output=True, text=True, timeout=30,
                    )
                    import json
                    probe_data = json.loads(probe_result.stdout)
                    duration = int(float(probe_data.get('format', {}).get('duration', 0)))
                    streams = probe_data.get('streams', [])
                    video_stream = next((s for s in streams if s.get('codec_type') == 'video'), {})
                    width = int(video_stream.get('width', 0))
                    height = int(video_stream.get('height', 0))
                except Exception:
                    duration, width, height = 0, 0, 0

                # Транскодируем в MP4 H.264
                transcode_cmd = [
                    'ffmpeg', '-i', input_path,
                    '-c:v', 'libx264', '-preset', 'medium',
                    '-crf', '23', '-c:a', 'aac', '-b:a', '128k',
                    '-movflags', '+faststart',
                    '-y', output_path,
                ]
                try:
                    subprocess.run(transcode_cmd, capture_output=True, timeout=120)
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    # Если ffmpeg недоступен — сохраняем как есть
                    output_path = input_path

                # Генерируем thumbnail (первый кадр)
                thumb_cmd = [
                    'ffmpeg', '-i', input_path,
                    '-ss', '00:00:01', '-vframes', '1',
                    '-vf', f'scale={THUMBNAIL_SIZE[0]}:-1',
                    '-y', thumb_path,
                ]
                thumb_bytes = None
                try:
                    subprocess.run(thumb_cmd, capture_output=True, timeout=30)
                    if os.path.exists(thumb_path):
                        with open(thumb_path, 'rb') as f:
                            thumb_bytes = f.read()
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    pass

                # Читаем обработанное видео
                with open(output_path, 'rb') as f:
                    processed_bytes = f.read()

                return processed_bytes, thumb_bytes, width, height, duration

            finally:
                # Cleanup
                for p in [input_path, output_path, thumb_path]:
                    try:
                        os.unlink(p)
                    except FileNotFoundError:
                        pass

        return await asyncio.to_thread(_process)


UPLOADS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads')


class MediaAssetService:
    """Управление медиа-ассетами профиля актёра."""

    def __init__(self):
        self.s3_service = S3MediaService(directory='actor-media')

    async def _save_file(self, file_name: str, file_bytes: bytes) -> str:
        """Upload to S3, fallback to local filesystem. Returns public URL."""
        try:
            await self.s3_service.upload_file(file_name=file_name, file=file_bytes)
            return f"{self.s3_service.base_url}/{file_name}"
        except Exception:
            local_path = os.path.join(UPLOADS_DIR, 'actor-media', file_name)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'wb') as f:
                f.write(file_bytes)
            return f"/uploads/actor-media/{file_name}"

    async def upload_photo(
        self,
        actor_profile_id: int,
        file: UploadFile,
        user_id: int,
    ) -> MediaAsset:
        """Загрузка и обработка фото."""
        if file.content_type not in ALLOWED_PHOTO_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"Unsupported image type: {file.content_type}"}
            )

        file_bytes = await file.read()
        if len(file_bytes) > MAX_PHOTO_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"File too large. Max size: {MAX_PHOTO_SIZE // (1024*1024)}MB"}
            )

        processed_bytes, thumb_bytes, width, height = await PhotoProcessor.process(
            file_bytes, file.content_type,
        )

        file_id = uuid.uuid4().hex
        original_name = f"{actor_profile_id}/{file_id}_original.jpg"
        processed_name = f"{actor_profile_id}/{file_id}_processed.jpg"
        thumb_name = f"{actor_profile_id}/{file_id}_thumb.jpg"

        original_url = await self._save_file(original_name, file_bytes)
        processed_url = await self._save_file(processed_name, processed_bytes)
        thumbnail_url = await self._save_file(thumb_name, thumb_bytes)

        media_asset = await self._save_media_asset(
            actor_profile_id=actor_profile_id,
            file_type='photo',
            original_url=original_url,
            processed_url=processed_url,
            thumbnail_url=thumbnail_url,
            original_filename=file.filename,
            mime_type='image/jpeg',
            file_size=len(processed_bytes),
            width=width,
            height_px=height,
        )
        return media_asset

    async def upload_video(
        self,
        actor_profile_id: int,
        file: UploadFile,
        user_id: int,
    ) -> MediaAsset:
        """Загрузка и транскодирование видео."""
        if file.content_type not in ALLOWED_VIDEO_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"Unsupported video type: {file.content_type}"}
            )

        file_bytes = await file.read()
        if len(file_bytes) > MAX_VIDEO_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"File too large. Max size: {MAX_VIDEO_SIZE // (1024*1024)}MB"}
            )

        processed_bytes, thumb_bytes, width, height, duration = await VideoProcessor.process(file_bytes)

        file_id = uuid.uuid4().hex
        original_name = f"{actor_profile_id}/{file_id}_original.mp4"
        processed_name = f"{actor_profile_id}/{file_id}_processed.mp4"
        thumb_name = f"{actor_profile_id}/{file_id}_thumb.jpg"

        original_url = await self._save_file(original_name, file_bytes)
        processed_url = await self._save_file(processed_name, processed_bytes)
        thumbnail_url = None
        if thumb_bytes:
            thumbnail_url = await self._save_file(thumb_name, thumb_bytes)

        media_asset = await self._save_media_asset(
            actor_profile_id=actor_profile_id,
            file_type='video',
            original_url=original_url,
            processed_url=processed_url,
            thumbnail_url=thumbnail_url,
            original_filename=file.filename,
            mime_type='video/mp4',
            file_size=len(processed_bytes),
            width=width,
            height_px=height,
            duration_sec=duration,
        )
        return media_asset

    @staticmethod
    @transaction
    async def _save_media_asset(session, **kwargs) -> MediaAsset:
        """Сохраняет запись медиа в БД."""
        asset = MediaAsset(**kwargs)
        session.add(asset)
        await session.flush()
        return asset

    @staticmethod
    @transaction
    async def delete_media_asset(session, asset_id: int, actor_profile_id: int) -> bool:
        """Удаляет медиа-ассет."""
        stmt = (
            delete(MediaAsset)
            .where(
                MediaAsset.id == asset_id,
                MediaAsset.actor_profile_id == actor_profile_id,
            )
        )
        await session.execute(stmt)
        return True

    @staticmethod
    @transaction
    async def set_primary(session, asset_id: int, actor_profile_id: int) -> bool:
        """Устанавливает медиа-ассет как основной."""
        # Снимаем primary со всех
        stmt_unset = (
            update(MediaAsset)
            .where(MediaAsset.actor_profile_id == actor_profile_id)
            .values(is_primary=False)
        )
        await session.execute(stmt_unset)

        # Ставим primary на выбранный
        stmt_set = (
            update(MediaAsset)
            .where(MediaAsset.id == asset_id, MediaAsset.actor_profile_id == actor_profile_id)
            .values(is_primary=True)
        )
        await session.execute(stmt_set)
        return True


