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
from users.models import ShortlistToken, ActorProfile, MediaAsset
from reports.models import Report, ProfilesReports
from profiles.models import Profile, ProfileImages
from config import settings

SHORTLIST_CACHE_TTL = 60


class ShortlistCacheService:
    """Кеш для шорт-листов. Redis если доступен, иначе in-memory."""

    _redis = None
    _memory_cache: Dict[str, Any] = {}
    _memory_ttl: Dict[str, float] = {}
    _use_redis: Optional[bool] = None

    @classmethod
    async def _init(cls):
        if cls._use_redis is not None:
            return
        redis_url = getattr(settings, 'REDIS_URL', None)
        if redis_url and '://:@' not in str(redis_url):
            try:
                import redis.asyncio as aioredis
                cls._redis = aioredis.from_url(redis_url, decode_responses=True)
                await cls._redis.ping()
                cls._use_redis = True
                return
            except Exception:
                pass
        cls._use_redis = False

    @classmethod
    async def _get_redis(cls):
        await cls._init()
        return cls._redis if cls._use_redis else None

    @classmethod
    async def get_cached_view(cls, token: str) -> Optional[Dict]:
        await cls._init()
        if cls._use_redis and cls._redis:
            data = await cls._redis.get(f"shortlist:view:{token}")
            if data:
                return json.loads(data)
            return None
        key = f"shortlist:view:{token}"
        import time
        if key in cls._memory_cache and cls._memory_ttl.get(key, 0) > time.time():
            return cls._memory_cache[key]
        cls._memory_cache.pop(key, None)
        return None

    @classmethod
    async def set_cached_view(cls, token: str, data: Dict) -> None:
        await cls._init()
        key = f"shortlist:view:{token}"
        if cls._use_redis and cls._redis:
            await cls._redis.set(key, json.dumps(data, default=str), ex=SHORTLIST_CACHE_TTL)
        else:
            import time
            cls._memory_cache[key] = data
            cls._memory_ttl[key] = time.time() + SHORTLIST_CACHE_TTL

    @classmethod
    async def invalidate_view(cls, token: str) -> None:
        r = await cls._get_redis()
        key = f"shortlist:view:{token}"
        if r:
            await r.delete(key)
            return
        cls._memory_cache.pop(key, None)
        cls._memory_ttl.pop(key, None)

    @classmethod
    async def invalidate_report(cls, report_id: int) -> None:
        """
        Инвалидация всех кешированных view при обновлении
        актёра или отчёта — по pattern.
        """
        r = await cls._get_redis()
        if r:
            # Ставим маркер, что данные по report_id стали dirty
            await r.set(f"shortlist:dirty:{report_id}", "1", ex=SHORTLIST_CACHE_TTL)
            return
        # In-memory fallback: очищаем кеш для гарантированно актуального SSOT-view.
        cls._memory_cache.clear()
        cls._memory_ttl.clear()


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

        was_first_view = shortlist_token.view_count == 0

        # Инкремент счётчика просмотров
        stmt_update = (
            update(ShortlistToken)
            .where(ShortlistToken.id == shortlist_token.id)
            .values(view_count=ShortlistToken.view_count + 1)
        )
        await session.execute(stmt_update)

        if was_first_view and shortlist_token.created_by:
            try:
                from crm.service import NotificationService
                from crm.models import NotificationType
                report = await session.get(Report, shortlist_token.report_id)
                report_title = report.title if report else f"Отчёт #{shortlist_token.report_id}"
                await NotificationService.create(
                    user_id=shortlist_token.created_by,
                    type=NotificationType.SYSTEM,
                    title="Отчёт просмотрен",
                    message=f"👁 Ваш отчёт «{report_title}» открыли по ссылке.",
                )
            except Exception:
                pass

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
        review_statuses = {pr.profile_id: getattr(pr, 'review_status', 'new') or 'new' for pr in report.profiles_reports}

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

        # Собираем user_id всех профилей для загрузки ActorProfile + MediaAssets
        user_ids = [p.user_id for p in profiles if p.user_id]
        actor_profiles_map = {}
        if user_ids:
            ap_stmt = (
                select(ActorProfile)
                .where(ActorProfile.user_id.in_(user_ids), ActorProfile.is_deleted == False)
                .options(selectinload(ActorProfile.media_assets))
            )
            ap_result = await session.execute(ap_stmt)
            for ap in ap_result.unique().scalars().all():
                actor_profiles_map[ap.user_id] = ap

        user_ids_set = set(u for u in user_ids if u)
        banned_user_ids = set()
        if user_ids_set:
            from users.models import User as _User
            banned_q = await session.execute(
                select(_User.id).where(_User.id.in_(user_ids_set), _User.is_active == False)
            )
            banned_user_ids = {row[0] for row in banned_q.all()}

        profiles_data = []
        for p in profiles:
            ap = actor_profiles_map.get(p.user_id)
            is_banned = p.user_id in banned_user_ids

            # Фото из новой системы media_assets (ActorProfile)
            images = []
            if ap and ap.media_assets:
                for m in sorted(ap.media_assets, key=lambda x: (not x.is_primary, x.sort_order)):
                    if m.file_type == 'photo':
                        images.append({
                            "id": m.id,
                            "photo_url": m.processed_url or m.original_url,
                            "crop_photo_url": m.thumbnail_url,
                            "image_type": "photo",
                        })

            # Fallback: старая система ProfileImages
            if not images and p.images:
                images = [
                    {
                        "id": img.id,
                        "photo_url": img.photo_url,
                        "crop_photo_url": img.crop_photo_url if hasattr(img, 'crop_photo_url') else None,
                        "image_type": img.image_type.value if img.image_type else None,
                    }
                    for img in p.images
                ]

            profiles_data.append({
                "id": p.id,
                "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                "gender": (ap.gender if ap and ap.gender else None) or (p.gender.value if p.gender else None),
                "height": (ap.height if ap and ap.height else None) or (float(p.height) if p.height else None),
                "date_of_birth": str(ap.date_of_birth) if ap and ap.date_of_birth else (str(p.date_of_birth) if p.date_of_birth else None),
                "city": (ap.city if ap and ap.city else None) or p.city_full,
                "qualification": (ap.qualification if ap and ap.qualification else None) or (p.qualification.value if p.qualification else None),
                "look_type": (ap.look_type if ap and ap.look_type else None) or (p.look_type.value if hasattr(p, 'look_type') and p.look_type and hasattr(p.look_type, 'value') else None),
                "about_me": (ap.about_me if ap else None) or p.about_me,
                "experience": (ap.experience if ap else None) or p.experience,
                "clothing_size": (float(ap.clothing_size) if ap and ap.clothing_size else None) if ap else (float(p.clothing_size) if p.clothing_size else None),
                "shoe_size": (float(ap.shoe_size) if ap and ap.shoe_size else None) if ap else (float(p.shoe_size) if p.shoe_size else None),
                "hair_color": (ap.hair_color if ap and ap.hair_color else None) or (p.hair_color.value if p.hair_color else None),
                "hair_length": (ap.hair_length if ap and ap.hair_length else None) or (p.hair_length.value if p.hair_length else None),
                "bust_volume": (ap.bust_volume if ap else None) or (float(p.bust_volume) if p.bust_volume else None),
                "waist_volume": (ap.waist_volume if ap else None) or (float(p.waist_volume) if p.waist_volume else None),
                "hip_volume": (ap.hip_volume if ap else None) or (float(p.hip_volume) if p.hip_volume else None),
                "video_intro": (ap.video_intro if ap else None) or p.video_intro,
                "images": images,
                "is_favorite": favorites.get(p.id, False),
                "review_status": review_statuses.get(p.id, "new"),
                "is_banned": is_banned,
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
    async def update_profile_review_status(
        cls,
        session,
        token: str,
        profile_id: int,
        new_status: str,
    ) -> bool:
        """Update review_status for a profile in a shortlist (public, token-based)."""
        if new_status not in ('new', 'accepted', 'reserve'):
            return False

        st = select(ShortlistToken).filter_by(token=token, is_active=True)
        result = await session.execute(st)
        shortlist_token = result.scalar_one_or_none()
        if not shortlist_token:
            return False

        stmt = (
            update(ProfilesReports)
            .where(
                ProfilesReports.report_id == shortlist_token.report_id,
                ProfilesReports.profile_id == profile_id,
            )
            .values(review_status=new_status)
        )
        res = await session.execute(stmt)
        if res.rowcount == 0:
            return False

        await ShortlistCacheService.invalidate_view(token)

        try:
            from crm.service import NotificationService
            from crm.models import NotificationType

            STATUS_LABELS = {'accepted': 'Принятые', 'reserve': 'Резерв', 'new': 'Новые'}
            status_label = STATUS_LABELS.get(new_status, new_status)

            actor_name = f"Актёр #{profile_id}"
            profile = await session.get(Profile, profile_id)
            if profile:
                parts = [p for p in [profile.first_name, profile.last_name] if p]
                if parts:
                    actor_name = " ".join(parts)

            report = await session.get(Report, shortlist_token.report_id)
            report_title = report.title if report else f"Отчёт #{shortlist_token.report_id}"

            owner_id = shortlist_token.created_by
            if owner_id:
                await NotificationService.create(
                    user_id=owner_id,
                    type=NotificationType.SYSTEM,
                    title="Действие в отчёте",
                    message=f"📋 В отчёте «{report_title}» актёр {actor_name} перемещён в «{status_label}».",
                )
        except Exception:
            pass

        return True

    @classmethod
    @transaction
    async def deactivate_token(cls, session, token_id: int) -> None:
        stmt = (
            update(ShortlistToken)
            .where(ShortlistToken.id == token_id)
            .values(is_active=False)
        )
        await session.execute(stmt)


