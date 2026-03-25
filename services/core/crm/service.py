"""
Season 04: Smart CRM Services.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from sqlalchemy import select, func, and_, update
from sqlalchemy.orm import joinedload

from postgres.database import async_session_maker as async_session
from crm.models import (
    Notification, NotificationType, NotificationChannel,
    TrustScoreLog, Blacklist, BanType, ActionLog,
)
from profiles.models import Profile
from users.models import User
from fastapi import HTTPException


class NotificationService:
    """4.1 Event-driven уведомления."""

    @staticmethod
    async def create(
        user_id: int,
        type: NotificationType,
        title: str,
        message: str = None,
        channel: NotificationChannel = NotificationChannel.IN_APP,
        casting_id: int = None,
        profile_id: int = None,
    ) -> int:
        async with async_session() as session:
            notif = Notification(
                user_id=user_id,
                type=type,
                channel=channel,
                title=title,
                message=message,
                related_casting_id=casting_id,
                related_profile_id=profile_id,
            )
            session.add(notif)
            await session.commit()
            return notif.id

    @staticmethod
    async def get_user_notifications(user_id: int, unread_only: bool = False,
                                      page: int = 1, page_size: int = 20) -> dict:
        async with async_session() as session:
            base = select(Notification).where(Notification.user_id == user_id)
            if unread_only:
                base = base.where(Notification.is_read == False)

            total = (await session.execute(
                select(func.count()).select_from(base.subquery())
            )).scalar() or 0

            result = await session.execute(
                base.order_by(Notification.created_at.desc())
                .offset((page - 1) * page_size).limit(page_size)
            )
            notifs = result.scalars().all()

            unread_count = (await session.execute(
                select(func.count()).where(
                    and_(Notification.user_id == user_id, Notification.is_read == False)
                )
            )).scalar() or 0

            return {
                "notifications": [
                    {
                        "id": n.id,
                        "type": n.type.value,
                        "channel": n.channel.value,
                        "title": n.title,
                        "message": n.message,
                        "is_read": n.is_read,
                        "casting_id": n.related_casting_id,
                        "created_at": str(n.created_at),
                    }
                    for n in notifs
                ],
                "total": total,
                "unread_count": unread_count,
            }

    @staticmethod
    async def mark_read(user_id: int, notification_id: int = None):
        async with async_session() as session:
            if notification_id:
                notif = await session.get(Notification, notification_id)
                if notif and notif.user_id == user_id:
                    notif.is_read = True
                    session.add(notif)
            else:
                await session.execute(
                    update(Notification)
                    .where(and_(Notification.user_id == user_id, Notification.is_read == False))
                    .values(is_read=True)
                )
            await session.commit()


class TrustScoreService:
    """
    4.2 Trust Score — алгоритм расчёта.
    +10 за заполнение профиля (каждое поле)
    +20 за посещение пробы (audition_attended)
    +5 за отклик на кастинг
    -15 за неявку (no_show)
    """

    SCORE_MAP = {
        'profile_completed': 10,
        'photo_uploaded': 5,
        'video_uploaded': 8,
        'response_sent': 5,
        'audition_attended': 20,
        'audition_no_show': -15,
        'profile_verified': 15,
    }

    @staticmethod
    async def add_event(profile_id: int, event_type: str, description: str = None) -> dict:
        points = TrustScoreService.SCORE_MAP.get(event_type, 0)

        async with async_session() as session:
            log = TrustScoreLog(
                profile_id=profile_id,
                event_type=event_type,
                points=points,
                description=description,
            )
            session.add(log)
            await session.commit()

            return {"profile_id": profile_id, "event": event_type, "points": points}

    @staticmethod
    async def calculate_score(profile_id: int) -> dict:
        async with async_session() as session:
            result = await session.execute(
                select(func.sum(TrustScoreLog.points))
                .where(TrustScoreLog.profile_id == profile_id)
            )
            total = result.scalar() or 0

            logs_result = await session.execute(
                select(TrustScoreLog)
                .where(TrustScoreLog.profile_id == profile_id)
                .order_by(TrustScoreLog.created_at.desc())
                .limit(10)
            )
            logs = logs_result.scalars().all()

            profile = await session.get(Profile, profile_id)
            completeness = TrustScoreService._calc_completeness(profile) if profile else 0

            return {
                "profile_id": profile_id,
                "trust_score": max(0, total),
                "profile_completeness": completeness,
                "recent_events": [
                    {
                        "event": l.event_type,
                        "points": l.points,
                        "description": l.description,
                        "date": str(l.created_at),
                    }
                    for l in logs
                ],
            }

    @staticmethod
    def _calc_completeness(profile: Profile) -> int:
        fields = [
            profile.first_name, profile.last_name, profile.gender,
            profile.date_of_birth, profile.phone_number, profile.email,
            profile.city_full, profile.qualification, profile.experience,
            profile.about_me, profile.look_type, profile.hair_color,
            profile.height, profile.video_intro,
        ]
        filled = sum(1 for f in fields if f is not None)
        return round((filled / len(fields)) * 100)


class BlacklistService:
    """4.3 Blacklist Engine."""

    @staticmethod
    async def ban_user(
        user_id: int,
        ban_type: str,
        reason: str,
        banned_by: int,
        days: int = None,
    ) -> dict:
        bt = BanType.TEMPORARY if ban_type == 'temporary' else BanType.PERMANENT

        async with async_session() as session:
            entry = Blacklist(
                user_id=user_id,
                ban_type=bt.value,
                reason_log=reason,
                banned_by=banned_by,
                is_active=True,
                expires_at=(
                    datetime.now(timezone.utc) + timedelta(days=days)
                    if days and bt == BanType.TEMPORARY else None
                ),
            )
            session.add(entry)

            user = await session.get(User, user_id)
            if user:
                user.is_active = False
                if getattr(user, 'is_employer_verified', False):
                    user.is_employer_verified = False
                session.add(user)

            await session.commit()
            try:
                await NotificationService.create(
                    user_id=user_id,
                    type=NotificationType.SYSTEM,
                    title="Аккаунт заблокирован",
                    message=reason,
                )
            except Exception:
                pass

            role_val = (user.role.value if hasattr(user.role, 'value') else str(user.role)) if user else 'unknown'
            return {
                "blacklist_id": entry.id,
                "user_id": user_id,
                "first_name": user.first_name if user else None,
                "last_name": user.last_name if user else None,
                "email": user.email if user else None,
                "role": role_val,
                "ban_type": bt.value,
                "reason": reason,
                "expires_at": str(entry.expires_at) if entry.expires_at else "permanent",
            }

    @staticmethod
    async def unban_user(user_id: int) -> dict:
        async with async_session() as session:
            result = await session.execute(
                select(Blacklist).where(
                    and_(Blacklist.user_id == user_id, Blacklist.is_active == True)
                )
            )
            entries = result.scalars().all()
            for e in entries:
                e.is_active = False
                session.add(e)

            user = await session.get(User, user_id)
            if user:
                user.is_active = True
                session.add(user)

            await session.commit()
            try:
                await NotificationService.create(
                    user_id=user_id,
                    type=NotificationType.SYSTEM,
                    title="Блокировка снята",
                    message="Ваш аккаунт снова активен.",
                )
            except Exception:
                pass
            return {"user_id": user_id, "status": "unbanned"}

    @staticmethod
    async def get_blacklist(page: int = 1, page_size: int = 20) -> dict:
        async with async_session() as session:
            base = select(Blacklist).where(Blacklist.is_active == True)
            total = (await session.execute(
                select(func.count()).select_from(base.subquery())
            )).scalar() or 0

            result = await session.execute(
                base.order_by(Blacklist.created_at.desc())
                .offset((page - 1) * page_size).limit(page_size)
            )
            entries = result.scalars().all()

            ROLE_LABELS = {
                'user': 'Актёр', 'agent': 'Агент',
                'employer': 'Админ', 'employer_pro': 'Админ PRO',
                'owner': 'SuperAdmin', 'administrator': 'Админ', 'manager': 'Админ',
            }

            items = []
            for e in entries:
                user = await session.get(User, e.user_id)
                role_val = (user.role.value if hasattr(user.role, 'value') else str(user.role)) if user else 'unknown'
                items.append({
                    "id": e.id,
                    "user_id": e.user_id,
                    "first_name": user.first_name if user else None,
                    "last_name": user.last_name if user else None,
                    "email": user.email if user else None,
                    "phone_number": getattr(user, 'phone_number', None) if user else None,
                    "role": role_val,
                    "role_label": ROLE_LABELS.get(role_val, role_val),
                    "photo_url": getattr(user, 'photo_url', None) if user else None,
                    "ban_type": str(e.ban_type),
                    "reason": e.reason_log,
                    "banned_at": str(e.created_at),
                    "expires_at": str(e.expires_at) if e.expires_at else "permanent",
                })

            return {"entries": items, "total": total}

    @staticmethod
    async def check_expired_bans() -> int:
        """Cron: снять истёкшие временные баны."""
        async with async_session() as session:
            now = datetime.now(timezone.utc)
            result = await session.execute(
                select(Blacklist).where(
                    and_(
                        Blacklist.is_active == True,
                        Blacklist.ban_type == BanType.TEMPORARY.value,
                        Blacklist.expires_at < now,
                    )
                )
            )
            expired = result.scalars().all()
            count = 0
            for e in expired:
                e.is_active = False
                session.add(e)
                user = await session.get(User, e.user_id)
                if user:
                    user.is_active = True
                    session.add(user)
                count += 1
            await session.commit()
            return count


class ActionLogService:
    """4.4 Collaboration: micro-chat + Action_Log."""

    @staticmethod
    def _format_user_name(user: User) -> tuple[str, str]:
        """Display name for internal chat: real name + role badge."""
        role_val = user.role.value if hasattr(user.role, 'value') else str(user.role)
        full_name = f"{user.first_name or ''} {user.last_name or ''}".strip()
        if not full_name:
            full_name = (user.email or "").split("@")[0] if user.email else f"User #{user.id}"

        ROLE_LABELS = {
            'owner': 'SuperAdmin',
            'employer_pro': 'Админ PRO',
            'employer': 'Админ',
            'administrator': 'Админ',
            'manager': 'Админ',
        }
        role_label = ROLE_LABELS.get(role_val, 'Пользователь')
        return f"{full_name}", role_val

    @staticmethod
    async def add_comment(
        casting_id: int,
        user_id: int,
        message: str,
        tagged_user_ids: List[int] = None,
    ) -> dict:
        async with async_session() as session:
            tags_str = ",".join(str(uid) for uid in tagged_user_ids) if tagged_user_ids else None

            log = ActionLog(
                casting_id=casting_id if casting_id != 0 else None,
                user_id=user_id,
                action_type='comment',
                message=message,
                tagged_user_ids=tags_str,
            )
            session.add(log)
            await session.commit()

            if tagged_user_ids:
                for uid in tagged_user_ids:
                    await NotificationService.create(
                        user_id=uid,
                        type=NotificationType.SYSTEM,
                        title=f"Вас упомянули в комментарии к проекту",
                        message=message[:200],
                        casting_id=casting_id,
                    )

            return {
                "id": log.id,
                "casting_id": casting_id,
                "action": "comment",
                "message": message,
                "tagged": tagged_user_ids or [],
            }

    @staticmethod
    async def log_event(casting_id: int, user_id: int, action_type: str, message: str = None):
        async with async_session() as session:
            log = ActionLog(
                casting_id=casting_id,
                user_id=user_id,
                action_type=action_type,
                message=message,
            )
            session.add(log)
            await session.commit()

    @staticmethod
    async def get_casting_log(casting_id: int, page: int = 1, page_size: int = 50) -> dict:
        async with async_session() as session:
            if casting_id == 0:
                base = select(ActionLog).where(ActionLog.casting_id.is_(None))
            else:
                base = select(ActionLog).where(ActionLog.casting_id == casting_id)
            total = (await session.execute(
                select(func.count()).select_from(base.subquery())
            )).scalar() or 0

            result = await session.execute(
                base.order_by(ActionLog.created_at.desc())
                .offset((page - 1) * page_size).limit(page_size)
            )
            logs = result.scalars().all()

            user_ids = list(set(l.user_id for l in logs if l.user_id))
            users_map = {}
            if user_ids:
                from users.models import User as UserModel
                users_result = await session.execute(
                    select(UserModel).where(UserModel.id.in_(user_ids))
                )
                for u in users_result.scalars().all():
                    display, role_val = ActionLogService._format_user_name(u)
                    users_map[u.id] = {"name": display, "role": role_val}

            return {
                "logs": [
                    {
                        "id": l.id,
                        "user_id": l.user_id,
                        "user_name": users_map.get(l.user_id, {}).get("name", f"User #{l.user_id}"),
                        "user_role": users_map.get(l.user_id, {}).get("role", "unknown"),
                        "action": l.action_type,
                        "message": l.message,
                        "tagged_users": l.tagged_user_ids.split(",") if l.tagged_user_ids else [],
                        "created_at": str(l.created_at),
                    }
                    for l in logs
                ],
                "total": total,
            }
