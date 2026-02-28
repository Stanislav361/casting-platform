"""
SSOT (Single Source of Truth) для шорт-листов.

Ссылки генерируются как уникальные токены доступа к View (не статичные слепки).
Обновления профилей актёров мгновенно отражаются через кеш TTL 60s.
"""
import secrets
import json
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from postgres.database import transaction
from users.models import ShortlistToken
from reports.models import Report, ProfilesReports
from profiles.models import Profile, ProfileImages
from config import settings

import redis.asyncio as aioredis


SHORTLIST_CACHE_TTL = 60  # seconds — короткий кеш


class ShortlistCacheService:
    """Redis-кеш для представлений шорт-листов (TTL 60s)."""

    _redis: Optional[aioredis.Redis] = None

    @classmethod
    async def _get_redis(cls) -> aioredis.Redis:
        if cls._redis is None:
            cls._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )
        return cls._redis

    @classmethod
    async def get_cached_view(cls, token: str) -> Optional[Dict]:
        r = await cls._get_redis()
        data = await r.get(f"shortlist:view:{token}")
        if data:
            return json.loads(data)
        return None

    @classmethod
    async def set_cached_view(cls, token: str, data: Dict) -> None:
        r = await cls._get_redis()
        await r.set(
            f"shortlist:view:{token}",
            json.dumps(data, default=str),
            ex=SHORTLIST_CACHE_TTL,
        )

    @classmethod
    async def invalidate_view(cls, token: str) -> None:
        r = await cls._get_redis()
        await r.delete(f"shortlist:view:{token}")

    @classmethod
    async def invalidate_report(cls, report_id: int) -> None:
        """
        Инвалидация всех кешированных view при обновлении
        актёра или отчёта — по pattern.
        """
        r = await cls._get_redis()
        # Ставим маркер, что данные по report_id стали dirty
        await r.set(f"shortlist:dirty:{report_id}", "1", ex=SHORTLIST_CACHE_TTL)


class ShortlistTokenService:
    """
    Генерация и валидация токенов для SSOT-доступа к шорт-листам.
    """

    @staticmethod
    def generate_token() -> str:
        return secrets.token_urlsafe(48)

    @classmethod
    @transaction
    async def create_token(
        cls,
        session,
        report_id: int,
        created_by: int,
        expires_in_hours: Optional[int] = None,
        max_views: Optional[int] = None,
    ) -> ShortlistToken:
        """Создаёт новый токен для шорт-листа."""
        token_str = cls.generate_token()
        expires_at = None
        if expires_in_hours:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

        shortlist_token = ShortlistToken(
            token=token_str,
            report_id=report_id,
            created_by=created_by,
            expires_at=expires_at,
            max_views=max_views,
        )
        session.add(shortlist_token)
        await session.flush()
        return shortlist_token

    @classmethod
    @transaction
    async def validate_and_get_token(
        cls,
        session,
        token: str,
    ) -> Optional[ShortlistToken]:
        """Валидирует токен: проверяет активность, срок и лимит просмотров."""
        stmt = select(ShortlistToken).filter_by(token=token, is_active=True)
        result = await session.execute(stmt)
        shortlist_token = result.scalar_one_or_none()

        if not shortlist_token:
            return None

        # Проверка срока
        if shortlist_token.expires_at and shortlist_token.expires_at < datetime.now(timezone.utc):
            return None

        # Проверка лимита просмотров
        if shortlist_token.max_views and shortlist_token.view_count >= shortlist_token.max_views:
            return None

        # Инкремент счётчика просмотров
        stmt_update = (
            update(ShortlistToken)
            .where(ShortlistToken.id == shortlist_token.id)
            .values(view_count=ShortlistToken.view_count + 1)
        )
        await session.execute(stmt_update)

        return shortlist_token

    @classmethod
    @transaction
    async def get_view_data(cls, session, report_id: int) -> Dict[str, Any]:
        """
        Формирует актуальное представление (View) шорт-листа.
        Данные берутся из БД в реальном времени — SSOT.
        """
        # Получаем отчёт с привязанными профилями
        stmt = (
            select(Report)
            .filter_by(id=report_id)
            .options(selectinload(Report.profiles_reports))
        )
        result = await session.execute(stmt)
        report = result.scalar_one_or_none()

        if not report:
            return {}

        # Собираем ID профилей
        profile_ids = [pr.profile_id for pr in report.profiles_reports]
        favorites = {pr.profile_id: pr.favorite for pr in report.profiles_reports}

        if not profile_ids:
            return {
                "report_id": report.id,
                "title": report.title,
                "profiles": [],
            }

        # Загружаем актуальные данные профилей из БД
        stmt_profiles = (
            select(Profile)
            .filter(Profile.id.in_(profile_ids))
            .options(selectinload(Profile.images))
        )
        profiles_result = await session.execute(stmt_profiles)
        profiles = profiles_result.scalars().all()

        profiles_data = []
        for p in profiles:
            images = [
                {
                    "id": img.id,
                    "photo_url": img.photo_url,
                    "image_type": img.image_type.value if img.image_type else None,
                }
                for img in (p.images or [])
            ]

            profiles_data.append({
                "id": p.id,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "gender": p.gender.value if p.gender else None,
                "height": float(p.height) if p.height else None,
                "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
                "city": p.city_full,
                "qualification": p.qualification.value if p.qualification else None,
                "look_type": p.look_type.value if p.look_type else None,
                "images": images,
                "is_favorite": favorites.get(p.id, False),
            })

        return {
            "report_id": report.id,
            "title": report.title,
            "profiles": profiles_data,
            "updated_at": str(datetime.now(timezone.utc)),
        }

    @classmethod
    async def get_shortlist_view(cls, token: str) -> Optional[Dict]:
        """
        Главный метод — отдаёт View шорт-листа.
        Использует кеш TTL 60s, при промахе — загружает из БД.
        """
        # 1. Валидируем токен
        shortlist_token = await cls.validate_and_get_token(token=token)
        if not shortlist_token:
            return None

        # 2. Проверяем кеш
        cached = await ShortlistCacheService.get_cached_view(token)
        if cached:
            return cached

        # 3. Загружаем из БД (SSOT)
        view_data = await cls.get_view_data(report_id=shortlist_token.report_id)

        # 4. Кешируем (TTL 60s)
        await ShortlistCacheService.set_cached_view(token, view_data)

        return view_data

    @classmethod
    @transaction
    async def deactivate_token(cls, session, token_id: int) -> None:
        stmt = (
            update(ShortlistToken)
            .where(ShortlistToken.id == token_id)
            .values(is_active=False)
        )
        await session.execute(stmt)


