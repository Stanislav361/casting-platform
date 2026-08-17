"""
SSOT (Single Source of Truth) для шорт-листов.

Ссылки генерируются как уникальные токены доступа к View (не статичные слепки).
Обновления профилей актёров мгновенно отражаются через кеш TTL 60s.
"""
import secrets
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from postgres.database import transaction, async_session_maker
from users.models import ShortlistToken, ActorProfile
from users.services.auth_token.types.jwt import JWT
from reports.models import Report, ProfilesReports
from profiles.models import Profile
from config import settings

logger = logging.getLogger(__name__)

SHORTLIST_CACHE_TTL = 60


def _enum_value(value):
    """Безопасно достаёт значение enum/строки. Не падает, если в БД лежит
    обычная строка вместо enum (иначе `.value` кидает AttributeError и весь
    каст лист отдаётся как 500 → у клиента бесконечное «Загружаем каст лист…»)."""
    if value is None:
        return None
    return value.value if hasattr(value, 'value') else str(value)


def _safe_float(value):
    """Приводит к float, не роняя каст лист на кривых данных."""
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


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
        актёра или каст листа — по pattern.
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
                report_title = report.title if report else f"Каст лист #{shortlist_token.report_id}"
                await NotificationService.create(
                    user_id=shortlist_token.created_by,
                    type=NotificationType.SYSTEM,
                    title="Каст лист просмотрен",
                    message=f"👁 Ваш каст лист «{report_title}» открыли по ссылке.",
                )
            except Exception:
                pass

        return shortlist_token

    @classmethod
    @transaction
    async def resolve_report_id(cls, session, token: str) -> Optional[int]:
        """Проверить токен и вернуть `report_id`, НЕ расходуя просмотр.

        `validate_and_get_token` инкрементирует `view_count` — для скачивания
        PDF это неверно: получатель ссылки с лимитом просмотров не должен
        терять просмотр из-за выгрузки того, что уже открыто на экране.

        Сами ограничения (активность, срок, лимит просмотров) проверяются ровно
        по тем же правилам: иначе исчерпанная ссылка перестала бы открываться,
        но продолжала отдавать тот же список в виде PDF.
        """
        stmt = select(ShortlistToken).filter_by(token=token, is_active=True)
        shortlist_token = (await session.execute(stmt)).scalar_one_or_none()

        if shortlist_token:
            if shortlist_token.expires_at and shortlist_token.expires_at < datetime.now(timezone.utc):
                return None
            if shortlist_token.max_views and shortlist_token.view_count >= shortlist_token.max_views:
                return None
            return shortlist_token.report_id

        # Fallback: публичный UUID каст листа (Report.public_id).
        return (
            await session.execute(select(Report.id).where(Report.public_id == token))
        ).scalar_one_or_none()

    @classmethod
    @transaction
    async def get_view_data(cls, session, report_id: int, include_contacts: bool = False) -> Dict[str, Any]:
        """
        Формирует актуальное представление (View) шорт-листа.
        Данные берутся из БД в реальном времени — SSOT.
        """
        # Получаем каст лист с привязанными профилями
        stmt = (
            select(Report)
            .filter_by(id=report_id)
            .options(selectinload(Report.profiles_reports))
        )
        result = await session.execute(stmt)
        report = result.scalar_one_or_none()

        if not report:
            return {}

        # Собираем ID профилей. Важно: один legacy Profile может соответствовать
        # нескольким ActorProfile агента, поэтому дальше итерируем не profiles,
        # а строки profiles_reports.
        profile_ids = [pr.profile_id for pr in report.profiles_reports]
        actor_profile_ids = [
            getattr(pr, 'actor_profile_id', None)
            for pr in report.profiles_reports
            if getattr(pr, 'actor_profile_id', None)
        ]

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
        profiles_by_id = {p.id: p for p in profiles}

        # Собираем user_id всех профилей для загрузки ActorProfile + MediaAssets
        user_ids = [p.user_id for p in profiles if p.user_id]
        actor_profiles_by_user = {}
        actor_profiles_by_id = {}
        if user_ids or actor_profile_ids:
            ap_filters = [ActorProfile.is_deleted.is_(False)]
            if user_ids and actor_profile_ids:
                ap_filters.append(
                    (ActorProfile.user_id.in_(user_ids)) | (ActorProfile.id.in_(actor_profile_ids))
                )
            elif user_ids:
                ap_filters.append(ActorProfile.user_id.in_(user_ids))
            else:
                ap_filters.append(ActorProfile.id.in_(actor_profile_ids))
            ap_stmt = (
                select(ActorProfile)
                .where(*ap_filters)
                .options(selectinload(ActorProfile.media_assets))
            )
            ap_result = await session.execute(ap_stmt)
            for ap in ap_result.unique().scalars().all():
                actor_profiles_by_id[ap.id] = ap
                actor_profiles_by_user[ap.user_id] = ap

        actor_profile_user_ids = {
            ap.user_id
            for ap in actor_profiles_by_id.values()
            if getattr(ap, 'user_id', None)
        }
        user_ids_set = set(u for u in user_ids if u) | actor_profile_user_ids
        banned_user_ids = set()
        agent_user_ids = set()
        users_map = {}
        if user_ids_set:
            from users.models import User as _User
            users_q = await session.execute(
                select(_User).where(_User.id.in_(user_ids_set))
            )
            for u in users_q.scalars().all():
                users_map[u.id] = u
                if not u.is_active:
                    banned_user_ids.add(u.id)
                role_val = u.role.value if hasattr(u.role, 'value') else str(u.role)
                if role_val == 'agent':
                    agent_user_ids.add(u.id)

        profiles_data = []
        for link in report.profiles_reports:
            p = profiles_by_id.get(link.profile_id)
            if not p:
                continue
            try:
                link_actor_profile_id = getattr(link, 'actor_profile_id', None)
                ap = (
                    actor_profiles_by_id.get(link_actor_profile_id)
                    if link_actor_profile_id
                    else actor_profiles_by_user.get(p.user_id)
                )
                owner_user_id = (ap.user_id if ap and ap.user_id else None) or p.user_id
                is_banned = owner_user_id in banned_user_ids
                is_agent_profile = owner_user_id in agent_user_ids
                owner_user = users_map.get(owner_user_id)

                # Фото из новой системы media_assets (ActorProfile).
                # `photo_category` (portrait / full_height / ...) нужен PDF-отчёту,
                # чтобы поставить в таблицу портрет и фото в полный рост, а не два
                # случайных кадра. В публичный ответ поле не попадает — его нет в
                # схеме SShortlistProfileImage.
                images = []
                if ap and ap.media_assets:
                    for m in sorted(ap.media_assets, key=lambda x: (not x.is_primary, x.sort_order or 0)):
                        if m.file_type == 'photo':
                            images.append({
                                "id": m.id,
                                "photo_url": m.processed_url or m.original_url,
                                "crop_photo_url": m.thumbnail_url,
                                "image_type": "photo",
                                "photo_category": _enum_value(getattr(m, 'photo_category', None)),
                            })

                # Fallback: старая система ProfileImages
                if not images and p.images:
                    images = [
                        {
                            "id": img.id,
                            "photo_url": img.photo_url,
                            "crop_photo_url": getattr(img, 'crop_photo_url', None),
                            "image_type": _enum_value(img.image_type),
                            "photo_category": _enum_value(img.image_type),
                        }
                        for img in p.images
                    ]

                # В публичном каст-листе видеовизитка должна воспроизводиться
                # прямо в анкете. Загруженный и обработанный файл приоритетнее
                # внешней ссылки из video_intro.
                uploaded_video = next(
                    (
                        media
                        for media in (ap.media_assets or [])
                        if getattr(media, "file_type", None) == "video"
                    ),
                    None,
                ) if ap else None
                video_intro = (
                    (uploaded_video.processed_url or uploaded_video.original_url)
                    if uploaded_video
                    else ((ap.video_intro if ap else None) or p.video_intro)
                )
                video_poster = uploaded_video.thumbnail_url if uploaded_video else None

                contact_payload = {}
                if include_contacts and not is_banned:
                    if is_agent_profile and owner_user:
                        name_parts = [x for x in [owner_user.first_name, owner_user.last_name] if x]
                        contact_phone = owner_user.phone_number
                        contact_email = owner_user.email
                        has_agent = True
                        agent_name = " ".join(name_parts) if name_parts else (owner_user.email or "Агент")
                    else:
                        contact_phone = (ap.phone_number if ap else None) or p.phone_number
                        contact_email = (ap.email if ap else None) or p.email
                        has_agent = False
                        agent_name = None

                    contact_payload = {
                        "phone_number": contact_phone,
                        "email": contact_email,
                        "telegram_nick": getattr(owner_user, 'telegram_nick', None) if owner_user else None,
                        "vk_nick": getattr(owner_user, 'vk_nick', None) if owner_user else None,
                        "max_nick": getattr(owner_user, 'max_nick', None) if owner_user else None,
                        "has_agent": has_agent,
                        "agent_name": agent_name,
                    }

                profile_data = {
                    "id": p.id,
                    "actor_profile_id": link_actor_profile_id or (ap.id if ap else None),
                    "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                    "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                    "gender": (ap.gender if ap and ap.gender else None) or _enum_value(p.gender),
                    "height": (ap.height if ap and ap.height else None) or _safe_float(p.height),
                    "date_of_birth": str(ap.date_of_birth) if ap and ap.date_of_birth else (str(p.date_of_birth) if p.date_of_birth else None),
                    "city": (ap.city if ap and ap.city else None) or p.city_full,
                    "metro_station": ap.metro_station if ap else None,
                    "qualification": (ap.qualification if ap and ap.qualification else None) or _enum_value(p.qualification),
                    "look_type": (ap.look_type if ap and ap.look_type else None) or _enum_value(getattr(p, 'look_type', None)),
                    "about_me": (ap.about_me if ap else None) or p.about_me,
                    "experience": (ap.experience if ap else None) or p.experience,
                    # `or`, а не `if ap else`: у анкеты агента размеры часто не
                    # заполнены, и тогда их нужно брать из старого профиля — как
                    # это уже делают рост и обхваты ниже. Иначе в каст листе и в
                    # PDF пропадают «обувь» и «размер».
                    "clothing_size": (_safe_float(ap.clothing_size) if ap and ap.clothing_size else None) or _safe_float(p.clothing_size),
                    "shoe_size": (_safe_float(ap.shoe_size) if ap and ap.shoe_size else None) or _safe_float(p.shoe_size),
                    "hair_color": (ap.hair_color if ap and ap.hair_color else None) or _enum_value(p.hair_color),
                    "hair_length": (ap.hair_length if ap and ap.hair_length else None) or _enum_value(p.hair_length),
                    "bust_volume": (ap.bust_volume if ap else None) or _safe_float(p.bust_volume),
                    "waist_volume": (ap.waist_volume if ap else None) or _safe_float(p.waist_volume),
                    "hip_volume": (ap.hip_volume if ap else None) or _safe_float(p.hip_volume),
                    "video_intro": video_intro,
                    "video_poster": video_poster,
                    "images": images,
                    "is_favorite": bool(link.favorite),
                    "review_status": getattr(link, 'review_status', 'new') or 'new',
                    "is_banned": is_banned,
                }
                profile_data.update(contact_payload)
                profiles_data.append(profile_data)
            except Exception as exc:
                # Один проблемный профиль не должен ронять весь каст лист (иначе 500
                # и бесконечная загрузка у клиента). Отдаём минимум по нему.
                logger.warning("shortlist view: skipping malformed profile %s: %s", getattr(p, 'id', '?'), exc)
                profiles_data.append({
                    "id": getattr(p, 'id', 0),
                    "first_name": getattr(p, 'first_name', None),
                    "last_name": getattr(p, 'last_name', None),
                    "images": [],
                    "is_favorite": bool(getattr(link, 'favorite', False)),
                    "review_status": getattr(link, 'review_status', 'new') or 'new',
                })

        return {
            "report_id": report.id,
            "title": report.title,
            "profiles": profiles_data,
            "updated_at": str(datetime.now(timezone.utc)),
        }

    @classmethod
    @transaction
    async def can_view_contacts(cls, session, report_id: int, viewer_token: Optional[JWT]) -> bool:
        if not viewer_token:
            return False

        role = getattr(viewer_token, 'role', None)
        if role in {'owner', 'administrator', 'manager'}:
            return True
        if role not in {'employer', 'employer_pro'}:
            return False

        try:
            user_id = int(viewer_token.id)
        except (TypeError, ValueError):
            return False

        from users.models import User
        user = await session.get(User, user_id)
        if not user or not user.is_active or not user.is_employer_verified:
            return False

        report = await session.get(Report, report_id)
        if not report:
            return False

        from castings.models import Casting
        from employer.service import EmployerService

        casting = await session.get(Casting, report.casting_id)
        if not casting:
            return False

        return await EmployerService._has_team_access(session, viewer_token, casting)

    @classmethod
    async def get_shortlist_view(cls, token: str, viewer_token: Optional[JWT] = None) -> Optional[Dict]:
        """
        Главный метод — отдаёт View шорт-листа.
        Использует кеш TTL 60s, при промахе — загружает из БД.

        Поддерживаются два формата идентификатора в URL:
          1. `ShortlistToken.token` — токены с ограничениями (expires/max_views).
          2. `Report.public_id` — публичный UUID каст листа (используется во
             внутреннем списке каст листов у админа; просмотр без ограничений).
        """
        # 1. Пробуем как полноценный shortlist-token
        shortlist_token = await cls.validate_and_get_token(token=token)
        if shortlist_token:
            include_contacts = await cls.can_view_contacts(
                report_id=shortlist_token.report_id,
                viewer_token=viewer_token,
            )
            if include_contacts:
                return await cls.get_view_data(
                    report_id=shortlist_token.report_id,
                    include_contacts=True,
                )

            cached = await ShortlistCacheService.get_cached_view(token)
            if cached:
                return cached
            view_data = await cls.get_view_data(report_id=shortlist_token.report_id)
            await ShortlistCacheService.set_cached_view(token, view_data)
            return view_data

        # 2. Fallback: пробуем как Report.public_id
        report_id = await cls._resolve_report_id_by_public_id(token)
        if report_id is None:
            return None

        include_contacts = await cls.can_view_contacts(
            report_id=report_id,
            viewer_token=viewer_token,
        )
        if include_contacts:
            return await cls.get_view_data(report_id=report_id, include_contacts=True)

        cached = await ShortlistCacheService.get_cached_view(f"public:{token}")
        if cached:
            return cached
        view_data = await cls.get_view_data(report_id=report_id)
        await ShortlistCacheService.set_cached_view(f"public:{token}", view_data)
        return view_data

    @classmethod
    async def _resolve_report_id_by_public_id(cls, public_id: str) -> Optional[int]:
        """Ищет Report по его public_id (UUID). Возвращает id или None."""
        try:
            async with async_session_maker() as session:
                stmt = select(Report.id).where(Report.public_id == public_id)
                result = await session.execute(stmt)
                return result.scalar_one_or_none()
        except Exception:
            return None

    @classmethod
    async def update_profile_review_status(
        cls,
        token: str,
        profile_id: int,
        new_status: str,
        actor_profile_id: Optional[int] = None,
    ) -> bool:
        """Update review_status for a profile in a shortlist (public, token-based).

        Главное — НАДЁЖНО сохранить статус. Поэтому сам UPDATE коммитится в
        отдельной транзакции, а инвалидация кеша и рассылка уведомлений
        выполняются best-effort ПОСЛЕ. Их сбой (например, недоступный Redis или
        ошибка при создании уведомления) больше не откатывает обновление статуса
        и не возвращает 500 клиенту — раньше из-за этого «не получалось обновить
        статус» в публичном каст листе.

        Поддерживается два формата идентификатора:
          1. `ShortlistToken.token`
          2. `Report.public_id` (публичный UUID — для внутреннего открытия админом)
        """
        if new_status not in ('new', 'accepted', 'reserve'):
            logger.warning("shortlist status: invalid new_status=%r", new_status)
            return False

        report_id, created_by = await cls._resolve_report_for_token(token=token)
        if report_id is None:
            logger.warning("shortlist status: token not resolved (token=%s)", token)
            return False

        updated = await cls._apply_review_status(
            report_id=report_id,
            profile_id=profile_id,
            new_status=new_status,
            actor_profile_id=actor_profile_id,
        )
        if not updated:
            logger.warning(
                "shortlist status: no matching row report_id=%s profile_id=%s actor_profile_id=%s",
                report_id, profile_id, actor_profile_id,
            )
            return False

        # Инвалидация кеша — best-effort.
        try:
            await ShortlistCacheService.invalidate_view(token)
            await ShortlistCacheService.invalidate_view(f"public:{token}")
        except Exception as exc:
            logger.warning("shortlist status: cache invalidate failed: %s", exc)

        # Уведомления — best-effort, в своей сессии (не влияют на результат).
        try:
            await cls._notify_review_status_change(
                report_id=report_id,
                created_by=created_by,
                profile_id=profile_id,
                new_status=new_status,
            )
        except Exception as exc:
            logger.warning("shortlist status: notify failed: %s", exc)

        return True

    @classmethod
    @transaction
    async def _resolve_report_for_token(cls, session, token: str):
        """Резолвит (report_id, created_by) по ShortlistToken.token или Report.public_id."""
        st = select(ShortlistToken).filter_by(token=token, is_active=True)
        shortlist_token = (await session.execute(st)).scalar_one_or_none()
        if shortlist_token:
            return shortlist_token.report_id, shortlist_token.created_by
        report_id = (
            await session.execute(select(Report.id).where(Report.public_id == token))
        ).scalar_one_or_none()
        return report_id, None

    @classmethod
    @transaction
    async def _apply_review_status(
        cls,
        session,
        report_id: int,
        profile_id: int,
        new_status: str,
        actor_profile_id: Optional[int] = None,
    ) -> bool:
        """Только сам UPDATE статуса — коммитится своей транзакцией."""
        attempts = []
        if actor_profile_id:
            attempts.append(ProfilesReports.actor_profile_id == actor_profile_id)
        attempts.append(ProfilesReports.profile_id == profile_id)
        attempts.append(ProfilesReports.actor_profile_id == profile_id)

        for condition in attempts:
            res = await session.execute(
                update(ProfilesReports)
                .where(
                    ProfilesReports.report_id == report_id,
                    condition,
                )
                .values(review_status=new_status)
            )
            if res.rowcount > 0:
                return True
        return False

    @classmethod
    @transaction
    async def _notify_review_status_change(
        cls, session, report_id, created_by, profile_id, new_status,
    ) -> None:
        """Best-effort уведомления о смене статуса (изолировано от UPDATE)."""
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

            report = await session.get(Report, report_id)
            report_title = report.title if report else f"Каст лист #{report_id}"

            owner_id = created_by
            if owner_id:
                await NotificationService.create(
                    user_id=owner_id,
                    type=NotificationType.SYSTEM,
                    title="Действие в каст листе",
                    message=f"📋 В каст листе «{report_title}» актёр {actor_name} перемещён в «{status_label}».",
                    casting_id=None,
                    profile_id=profile_id,
                )

            # Также уведомляем команду проекта (collaborators), если каст лист связан с кастингом
            try:
                from castings.models import ProjectCollaborator, Casting
                casting_id = getattr(report, 'casting_id', None) if report else None
                if casting_id:
                    casting = await session.get(Casting, casting_id)
                    if casting:
                        collab_res = await session.execute(
                            select(ProjectCollaborator.user_id).where(
                                ProjectCollaborator.casting_id == casting_id,
                            )
                        )
                        collab_ids = {int(uid) for uid in collab_res.scalars().all() if uid is not None}
                        # + владелец кастинга
                        if getattr(casting, 'owner_id', None):
                            collab_ids.add(int(casting.owner_id))
                        # исключаем автора каст листа (он уже получил уведомление выше)
                        if owner_id:
                            collab_ids.discard(int(owner_id))
                        for uid in collab_ids:
                            await NotificationService.create(
                                user_id=uid,
                                type=NotificationType.SYSTEM,
                                title="Действие в каст листе",
                                message=f"📋 В каст листе «{report_title}» актёр {actor_name} перемещён в «{status_label}».",
                                casting_id=casting_id,
                                profile_id=profile_id,
                            )
            except Exception:
                pass

            # Уведомляем агента — на ЛЮБУЮ смену статуса его актёра
            if profile and profile.user_id:
                from users.models import User as _AgentUser
                actor_owner = await session.get(_AgentUser, profile.user_id)
                if actor_owner:
                    role_val = actor_owner.role.value if hasattr(actor_owner.role, 'value') else str(actor_owner.role)
                    if role_val == 'agent':
                        if new_status == 'accepted':
                            title = f"🎉 {actor_name} принят!"
                            msg = f"Актёр {actor_name} принят в каст листе «{report_title}»."
                        elif new_status == 'reserve':
                            title = f"⏳ {actor_name} — в резерв"
                            msg = f"Актёр {actor_name} перемещён в «Резерв» в каст листе «{report_title}»."
                        else:
                            title = f"📝 {actor_name}: новое действие"
                            msg = f"Актёр {actor_name} перемещён в «{status_label}» в каст листе «{report_title}»."
                        await NotificationService.create(
                            user_id=actor_owner.id,
                            type=NotificationType.SYSTEM,
                            title=title,
                            message=msg,
                            profile_id=profile_id,
                        )
        except Exception:
            pass

    @classmethod
    @transaction
    async def deactivate_token(cls, session, token_id: int) -> None:
        stmt = (
            update(ShortlistToken)
            .where(ShortlistToken.id == token_id)
            .values(is_active=False)
        )
        await session.execute(stmt)


