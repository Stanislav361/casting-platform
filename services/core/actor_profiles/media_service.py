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
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload

from postgres.database import transaction
from users.models import ActorProfile, MediaAsset
from shared.services.s3.services.media import S3MediaService
from config import settings

try:
    from PIL import Image, ImageOps
except ImportError:
    Image = None
    ImageOps = None

# Регистрируем декодер HEIF/HEIC прямо здесь: фото с iPhone приходят в HEIC, и
# без зарегистрированного opener'а PIL.Image.open падает с необработанной
# ошибкой → 500 «Ошибка при загрузке». Регистрация идемпотентна и безопасна,
# даже если её уже выполнил другой модуль.
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except Exception:
    pass


# ─── Конфигурация обработки медиа ───

PHOTO_MAX_SIZE = (1920, 1920)      # Максимальный размер обработанного фото
THUMBNAIL_SIZE = (300, 300)         # Размер thumbnail
PHOTO_QUALITY = 85                  # JPEG quality
PHOTO_MIN_WIDTH = 600               # Минимальная ширина обязательного фото
PHOTO_MIN_HEIGHT = 800              # Минимальная высота обязательного фото
# Целевое соотношение сторон (высота/ширина) для обязательных кадров.
# Если фото слишком широкое/квадратное — аккуратно подрежем бока по центру,
# чтобы кадр стал вертикальным. По вертикали актёра не режем.
PHOTO_TARGET_RATIOS = {
    'portrait': 1.4,
    'profile': 1.4,
    'full_height': 1.6,
}
ALLOWED_PHOTO_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/heif', 'image/heic'}
ALLOWED_VIDEO_TYPES = {'video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'}
MAX_PHOTO_SIZE = 20 * 1024 * 1024   # 20MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB
MAX_PHOTO_COUNT = 10
REQUIRED_PHOTO_CATEGORIES = {'portrait', 'profile', 'full_height'}
ALLOWED_PHOTO_CATEGORIES = REQUIRED_PHOTO_CATEGORIES | {'additional'}


class PhotoProcessor:
    """Обработка фотографий — ресайз и thumbnail."""

    @staticmethod
    def _auto_fit_vertical(img, photo_category: Optional[str]):
        """Автоматически приводит обязательное фото к вертикальному формату.

        Клиенту не нужно вручную подбирать кадр: если фото горизонтальное или
        квадратное, аккуратно подрезаем бока по центру до нужного соотношения,
        а если оно слишком маленькое — увеличиваем до минимального размера.
        По вертикали актёра не обрезаем, поэтому голова/ноги не теряются.
        """
        target = PHOTO_TARGET_RATIOS.get(photo_category or '')
        if not target:
            return img

        width, height = img.size
        if width <= 0 or height <= 0:
            return img

        ratio = height / width
        if ratio < target:
            # Слишком широкий кадр → подрезаем бока по центру.
            new_width = max(1, int(round(height / target)))
            new_width = min(new_width, width)
            left = max(0, (width - new_width) // 2)
            img = img.crop((left, 0, left + new_width, height))

        # Догоняем до минимального размера, если фото мелкое.
        width, height = img.size
        if width < PHOTO_MIN_WIDTH or height < PHOTO_MIN_HEIGHT:
            scale = max(PHOTO_MIN_WIDTH / width, PHOTO_MIN_HEIGHT / height)
            img = img.resize(
                (int(round(width * scale)), int(round(height * scale))),
                Image.LANCZOS,
            )

        return img

    @staticmethod
    async def process(
        file_bytes: bytes,
        mime_type: str,
        photo_category: Optional[str] = None,
    ) -> Tuple[bytes, bytes, int, int]:
        """
        Обрабатывает фото: авто-подгонка под вертикальный формат (для
        обязательных кадров) + ресайз до макс. размера + thumbnail.
        Returns: (processed_bytes, thumbnail_bytes, width, height)
        """
        if Image is None:
            return file_bytes, file_bytes, 0, 0

        def _process():
            try:
                img = Image.open(io.BytesIO(file_bytes))
                img.load()
            except Exception as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"message": "Не удалось обработать фото. Попробуйте другой файл или формат (JPG/PNG)."},
                ) from exc

            # Учитываем ориентацию из EXIF (фото с телефона часто «повёрнуты»).
            if ImageOps is not None:
                try:
                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass

            # Конвертируем HEIF/HEIC
            if img.mode in ('RGBA', 'LA', 'PA'):
                bg = Image.new('RGB', img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = bg
            elif img.mode != 'RGB':
                img = img.convert('RGB')

            # Авто-подгонка обязательных кадров под вертикальный формат.
            img = PhotoProcessor._auto_fit_vertical(img, photo_category)

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


UPLOADS_DIR = os.environ.get("UPLOADS_DIR") or os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'uploads')


class MediaAssetService:
    """Управление медиа-ассетами профиля актёра."""

    def __init__(self):
        self.s3_service = S3MediaService(directory='actor-media')

    async def _save_file(self, file_name: str, file_bytes: bytes, base_url: str = "") -> str:
        """Upload to S3, fallback to local filesystem. Returns public URL."""
        try:
            await self.s3_service.upload_file(file_name=file_name, file=file_bytes)
            return f"{self.s3_service.base_url}/{file_name}"
        except Exception:
            local_path = os.path.join(UPLOADS_DIR, 'actor-media', file_name)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, 'wb') as f:
                f.write(file_bytes)
            if base_url:
                return f"{base_url.rstrip('/')}/uploads/actor-media/{file_name}"
            return f"/uploads/actor-media/{file_name}"

    async def upload_photo(
        self,
        actor_profile_id: int,
        file: UploadFile,
        photo_category: str,
        user_id: int,
        base_url: str = "",
        make_primary: bool = False,
    ) -> MediaAsset:
        """Загрузка и обработка фото."""
        normalized_category = (photo_category or '').strip().lower()
        if normalized_category not in ALLOWED_PHOTO_CATEGORIES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Unsupported photo category"}
            )

        await self._validate_photo_category(actor_profile_id=actor_profile_id, photo_category=normalized_category)
        replacing_asset = await self._get_replaceable_required_photo(
            actor_profile_id=actor_profile_id,
            photo_category=normalized_category,
        )
        await self._validate_photo_limit(
            actor_profile_id=actor_profile_id,
            replacing_asset_id=replacing_asset.id if replacing_asset else None,
        )

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
            file_bytes, file.content_type, normalized_category,
        )
        self._validate_photo_dimensions(
            photo_category=normalized_category,
            width=width,
            height=height,
        )

        if replacing_asset:
            await self.delete_media_asset(
                asset_id=replacing_asset.id,
                actor_profile_id=actor_profile_id,
            )

        file_id = uuid.uuid4().hex
        original_name = f"{actor_profile_id}/{file_id}_original.jpg"
        processed_name = f"{actor_profile_id}/{file_id}_processed.jpg"
        thumb_name = f"{actor_profile_id}/{file_id}_thumb.jpg"

        original_url = await self._save_file(original_name, file_bytes, base_url)
        processed_url = await self._save_file(processed_name, processed_bytes, base_url)
        thumbnail_url = await self._save_file(thumb_name, thumb_bytes, base_url)

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
            photo_category=normalized_category,
            is_primary=bool(replacing_asset.is_primary) if replacing_asset else False,
        )
        if make_primary and media_asset.id:
            await self.set_primary(
                asset_id=media_asset.id,
                actor_profile_id=actor_profile_id,
            )
            media_asset.is_primary = True
        return media_asset

    @staticmethod
    @transaction
    async def _validate_photo_limit(session, actor_profile_id: int, replacing_asset_id: Optional[int] = None) -> None:
        photo_count = await session.scalar(
            select(func.count(MediaAsset.id)).where(
                MediaAsset.actor_profile_id == actor_profile_id,
                MediaAsset.file_type == 'photo',
                *( [MediaAsset.id != replacing_asset_id] if replacing_asset_id else [] ),
            )
        )
        if (photo_count or 0) >= MAX_PHOTO_COUNT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": f"Можно загрузить не больше {MAX_PHOTO_COUNT} фото"}
            )

    @staticmethod
    @transaction
    async def _validate_photo_category(session, actor_profile_id: int, photo_category: str) -> None:
        existing_categories = set(
            await session.scalars(
                select(MediaAsset.photo_category).where(
                    MediaAsset.actor_profile_id == actor_profile_id,
                    MediaAsset.file_type == 'photo',
                    MediaAsset.photo_category.isnot(None),
                )
            )
        )
        missing_categories = REQUIRED_PHOTO_CATEGORIES - existing_categories

        if not missing_categories:
            return

        if photo_category == 'additional':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Сначала загрузите обязательные фото: портрет, профиль и полный рост"}
            )

        if photo_category in existing_categories and (missing_categories - {photo_category}):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Сначала добавьте недостающие обязательные ракурсы"}
            )

    @staticmethod
    @transaction
    async def _get_replaceable_required_photo(session, actor_profile_id: int, photo_category: str) -> Optional[MediaAsset]:
        if photo_category not in REQUIRED_PHOTO_CATEGORIES:
            return None
        result = await session.execute(
            select(MediaAsset).where(
                MediaAsset.actor_profile_id == actor_profile_id,
                MediaAsset.file_type == 'photo',
                MediaAsset.photo_category == photo_category,
            ).limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _validate_photo_dimensions(photo_category: str, width: int, height: int) -> None:
        if photo_category == 'additional':
            return

        # Обязательные кадры уже автоматически приводятся к вертикальному
        # формату в PhotoProcessor, поэтому жёсткие ограничения по соотношению
        # сторон и минимальному размеру здесь не нужны — оставляем только
        # проверку, что изображение в принципе удалось прочитать.
        if not width or not height:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"message": "Не удалось обработать изображение. Попробуйте другой файл"},
            )

    async def upload_video(
        self,
        actor_profile_id: int,
        file: UploadFile,
        user_id: int,
        base_url: str = "",
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

        original_url = await self._save_file(original_name, file_bytes, base_url)
        processed_url = await self._save_file(processed_name, processed_bytes, base_url)
        thumbnail_url = None
        if thumb_bytes:
            thumbnail_url = await self._save_file(thumb_name, thumb_bytes, base_url)

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


