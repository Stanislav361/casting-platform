"""
Единый биллинг-модуль подписок «Админ» / «Админ PRO».

Единственный источник истины для тарифов и подписок пользователей-работодателей.
Ранее в проекте параллельно существовал второй, несогласованный механизм
(employer/subscription.py, таблица `subscriptions`, коды 'admin'/'admin_pro'
без grace-периода) — он унифицирован в этот модуль; таблица `subscriptions`
удалена миграцией v17_unify_billing_subscriptions.

3.1 Тарификация: «Админ» (admin) = только отклики, «Админ PRO» (admin_pro) = полный поиск
3.2 Cron-задачи: проверка expires_at, Grace period 24h, деактивация
3.3 Data Isolation: виртуализация полей для внешних пользователей
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy import select, and_, update
from sqlalchemy.orm import joinedload

from postgres.database import async_session_maker as async_session
from billing.models import BillingPlan, UserSubscription
from users.models import User
from users.enums import ModelRoles, SubscriptionType
from profiles.models import Profile, Response
from fastapi import HTTPException


INTERNAL_FIELDS = ['internal_notes', 'admin_rating']


class BillingService:
    """Управление подписками и тарифами."""

    @staticmethod
    async def get_plans() -> list:
        async with async_session() as session:
            result = await session.execute(
                select(BillingPlan).where(BillingPlan.is_active == True)
            )
            plans = result.scalars().all()
            return [
                {
                    "id": p.id,
                    "code": p.code,
                    "name": p.name,
                    "description": p.description,
                    "price_monthly": float(p.price_monthly),
                    "price_yearly": float(p.price_yearly) if p.price_yearly else None,
                    "max_projects": p.max_projects,
                    "can_search_all_actors": p.can_search_all_actors,
                    "can_fulltext_search": p.can_fulltext_search,
                    "can_create_shortlists": p.can_create_shortlists,
                }
                for p in plans
            ]

    @staticmethod
    async def subscribe(user_id: int, plan_code: str, days: int = 30) -> dict:
        """Оформить/продлить подписку. `days` — длительность оплаченного периода в днях
        (для месячного тарифа обычно 30, для годового — 365 и т.д. — период задаёт вызывающая
        сторона, единой связки с конкретным числом месяцев в сервисе больше нет)."""
        valid_codes = {t.value for t in SubscriptionType}
        if plan_code not in valid_codes:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown plan code '{plan_code}'. Available: {sorted(valid_codes)}",
            )

        async with async_session() as session:
            plan_result = await session.execute(
                select(BillingPlan).where(BillingPlan.code == plan_code, BillingPlan.is_active == True)
            )
            plan = plan_result.scalar_one_or_none()
            if not plan:
                raise HTTPException(status_code=404, detail=f"Plan '{plan_code}' not found")

            now = datetime.now(timezone.utc)
            expires = now + timedelta(days=days)
            grace = expires + timedelta(hours=24)

            sub = UserSubscription(
                user_id=user_id,
                plan_id=plan.id,
                status='active',
                starts_at=now,
                expires_at=expires,
                grace_until=grace,
            )
            session.add(sub)

            new_role = ModelRoles.employer_pro if plan.can_search_all_actors else ModelRoles.employer
            user = await session.get(User, user_id)
            if user:
                user.role = new_role
                session.add(user)

            await session.commit()

            return {
                "subscription_id": sub.id,
                "user_id": user_id,
                "plan": plan.code,
                "status": "active",
                "starts_at": str(now),
                "expires_at": str(expires),
                "grace_until": str(grace),
                "days": days,
                "role": new_role.value,
            }

    @staticmethod
    async def has_active_subscription(user_id: int) -> bool:
        """Единая проверка «есть ли у пользователя действующая (не истёкшая) подписка».

        Используется, в частности, при приглашении Админа/Админа PRO в команду —
        раньше эта проверка независимо и неверно смотрела в устаревшую таблицу
        `subscriptions` (employer/subscription.py), из-за чего приглашение в команду
        было фактически неработоспособно (там никогда не появлялись строки). Теперь
        и оформление подписки, и её проверка идут через одну и ту же таблицу.
        """
        sub = await BillingService.get_user_subscription(user_id)
        if not sub:
            return False
        now = datetime.now(timezone.utc)
        expires_at = sub.get("expires_at")
        if not expires_at:
            return False
        expires_dt = datetime.fromisoformat(expires_at)
        if expires_dt.tzinfo is None:
            expires_dt = expires_dt.replace(tzinfo=timezone.utc)
        grace_until = sub.get("grace_until")
        if grace_until:
            grace_dt = datetime.fromisoformat(grace_until)
            if grace_dt.tzinfo is None:
                grace_dt = grace_dt.replace(tzinfo=timezone.utc)
            return now <= grace_dt
        return now <= expires_dt

    @staticmethod
    async def get_user_subscription(user_id: int) -> Optional[dict]:
        async with async_session() as session:
            result = await session.execute(
                select(UserSubscription)
                .options(joinedload(UserSubscription.plan))
                .where(UserSubscription.user_id == user_id)
                .order_by(UserSubscription.created_at.desc())
                .limit(1)
            )
            sub = result.scalar_one_or_none()
            if not sub:
                return None

            now = datetime.now(timezone.utc)
            is_expired = sub.expires_at < now
            is_in_grace = bool(sub.grace_until and sub.expires_at < now <= sub.grace_until)
            return {
                "plan_code": sub.plan.code if sub.plan else None,
                "plan_name": sub.plan.name if sub.plan else None,
                "status": sub.status,
                "is_active": sub.status == 'active' and not is_expired,
                "starts_at": str(sub.starts_at),
                "expires_at": str(sub.expires_at),
                "grace_until": str(sub.grace_until) if sub.grace_until else None,
                "is_expired": is_expired,
                "is_in_grace": is_in_grace,
            }

    @staticmethod
    async def check_and_deactivate_expired() -> dict:
        """
        3.2 Cron-задача: проверка валидности подписок.
        - Если expires_at прошёл → status = 'grace'
        - Если grace_until прошёл → status = 'expired', роль → user
        """
        async with async_session() as session:
            now = datetime.now(timezone.utc)

            grace_result = await session.execute(
                select(UserSubscription).where(
                    and_(
                        UserSubscription.status == 'active',
                        UserSubscription.expires_at < now,
                        UserSubscription.grace_until >= now,
                    )
                )
            )
            grace_subs = grace_result.scalars().all()
            grace_count = 0
            for sub in grace_subs:
                sub.status = 'grace'
                session.add(sub)
                try:
                    from crm.models import NotificationType
                    from crm.service import NotificationService
                    await NotificationService.create(
                        user_id=sub.user_id,
                        type=NotificationType.SYSTEM,
                        title="Подписка перешла в grace-period",
                        message="Подписка истекла. Льготный период: 24 часа.",
                    )
                except Exception:
                    pass
                grace_count += 1

            expired_result = await session.execute(
                select(UserSubscription).where(
                    and_(
                        UserSubscription.status.in_(['active', 'grace']),
                        UserSubscription.grace_until < now,
                    )
                )
            )
            expired_subs = expired_result.scalars().all()
            expired_count = 0
            for sub in expired_subs:
                sub.status = 'expired'
                session.add(sub)

                user = await session.get(User, sub.user_id)
                if user and user.role.value in ['employer', 'employer_pro']:
                    user.role = ModelRoles.user
                    session.add(user)
                try:
                    from crm.models import NotificationType
                    from crm.service import NotificationService
                    await NotificationService.create(
                        user_id=sub.user_id,
                        type=NotificationType.SYSTEM,
                        title="Подписка деактивирована",
                        message="Grace-period завершен. Права доступа снижены до базовых.",
                    )
                except Exception:
                    pass
                expired_count += 1

            await session.commit()
            return {"moved_to_grace": grace_count, "deactivated": expired_count}


class DataIsolationService:
    """
    3.3 Data Isolation — виртуализация полей.
    Внешний кастинг-директор получает объект Actor без internal_notes, admin_rating, history_logs.
    """

    @staticmethod
    def sanitize_profile(profile_dict: dict, is_internal: bool = False) -> dict:
        if is_internal:
            return profile_dict

        sanitized = {k: v for k, v in profile_dict.items() if k not in INTERNAL_FIELDS}
        sanitized.pop('history_logs', None)
        return sanitized

    @staticmethod
    async def get_public_actor_profile(profile_id: int) -> dict:
        """Публичный профиль актёра — без internal полей."""
        async with async_session() as session:
            profile = await session.get(Profile, profile_id)
            if not profile:
                raise HTTPException(status_code=404, detail="Profile not found")

            data = {
                "id": profile.id,
                "first_name": profile.first_name,
                "last_name": profile.last_name,
                "gender": profile.gender.value if hasattr(profile.gender, 'value') else str(profile.gender) if profile.gender else None,
                "city": str(profile.city_full) if profile.city_full else None,
                "qualification": profile.qualification.value if hasattr(profile.qualification, 'value') else str(profile.qualification) if profile.qualification else None,
                "experience": profile.experience,
                "about_me": profile.about_me,
                "height": float(profile.height) if profile.height else None,
                "look_type": profile.look_type.value if hasattr(profile.look_type, 'value') else str(profile.look_type) if profile.look_type else None,
            }
            return DataIsolationService.sanitize_profile(data, is_internal=False)


class SearchService:
    """
    3.1 Тарификация поиска:
    - Basic: фильтрация по JOIN с откликами на конкретный Project_ID
    - Pro: полнотекстовый поиск по всей базе
    """

    @staticmethod
    async def search_respondents(casting_id: int, query: Optional[str] = None,
                                  page: int = 1, page_size: int = 20) -> dict:
        """Basic: поиск среди откликнувшихся на конкретный проект."""
        async with async_session() as session:
            from sqlalchemy import func

            base = (
                select(Profile)
                .join(Response, Response.profile_id == Profile.id)
                .where(Response.casting_id == casting_id)
            )

            if query:
                base = base.where(
                    Profile.first_name.ilike(f"%{query}%") |
                    Profile.last_name.ilike(f"%{query}%")
                )

            total = (await session.execute(
                select(func.count()).select_from(base.subquery())
            )).scalar() or 0

            result = await session.execute(
                base.order_by(Profile.created_at.desc())
                .offset((page - 1) * page_size).limit(page_size)
            )
            profiles = result.scalars().unique().all()

            return {
                "actors": [DataIsolationService.sanitize_profile({
                    "id": p.id,
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "gender": p.gender.value if hasattr(p.gender, 'value') else None,
                    "city": str(p.city_full) if p.city_full else None,
                    "qualification": p.qualification.value if hasattr(p.qualification, 'value') else None,
                }) for p in profiles],
                "total": total,
                "search_type": "basic",
            }

    @staticmethod
    async def search_global(query: str, page: int = 1, page_size: int = 20) -> dict:
        """Pro: полнотекстовый поиск по всей базе (PostgreSQL full-text или будущий Meilisearch)."""
        async with async_session() as session:
            from sqlalchemy import func, or_, cast, String

            base = select(Profile).where(
                or_(
                    Profile.first_name.ilike(f"%{query}%"),
                    Profile.last_name.ilike(f"%{query}%"),
                    Profile.about_me.ilike(f"%{query}%"),
                    Profile.email.ilike(f"%{query}%"),
                )
            )

            total = (await session.execute(
                select(func.count()).select_from(base.subquery())
            )).scalar() or 0

            result = await session.execute(
                base.order_by(Profile.created_at.desc())
                .offset((page - 1) * page_size).limit(page_size)
            )
            profiles = result.scalars().unique().all()

            return {
                "actors": [DataIsolationService.sanitize_profile({
                    "id": p.id,
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "gender": p.gender.value if hasattr(p.gender, 'value') else None,
                    "city": str(p.city_full) if p.city_full else None,
                    "qualification": p.qualification.value if hasattr(p.qualification, 'value') else None,
                    "experience": p.experience,
                    "about_me": p.about_me,
                }) for p in profiles],
                "total": total,
                "search_type": "global_pro",
            }
