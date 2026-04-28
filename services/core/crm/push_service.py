"""
Web Push Notifications Service.

VAPID keys стоят в config (ENV: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).
Если ключи не заданы или библиотека pywebpush недоступна — push молча
скипается, in_app уведомления продолжают работать.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from sqlalchemy import Column, Integer, String, Text, ForeignKey, TIMESTAMP, Index, select, delete
from datetime import datetime, timezone

from postgres.database import Base, async_session_maker as async_session
from config import settings


logger = logging.getLogger(__name__)


try:  # graceful degradation
    from pywebpush import webpush, WebPushException  # type: ignore
    _PYWEBPUSH_AVAILABLE = True
except Exception:  # pragma: no cover
    webpush = None  # type: ignore
    WebPushException = Exception  # type: ignore
    _PYWEBPUSH_AVAILABLE = False


class PushSubscription(Base):
    """Подписка пользователя на web push."""
    __tablename__ = 'push_subscriptions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey('users.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    user_agent = Column(String(500), nullable=True)
    created_at = Column(
        TIMESTAMP(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index('ix_push_sub_user', 'user_id'),
    )


def is_configured() -> bool:
    return bool(
        _PYWEBPUSH_AVAILABLE
        and settings.VAPID_PUBLIC_KEY
        and settings.VAPID_PRIVATE_KEY
    )


class PushService:
    """Регистрация подписок + отправка уведомлений."""

    @staticmethod
    async def subscribe(
        user_id: int,
        endpoint: str,
        p256dh: str,
        auth: str,
        user_agent: Optional[str] = None,
    ) -> int:
        async with async_session() as session:
            existing = await session.execute(
                select(PushSubscription).where(PushSubscription.endpoint == endpoint)
            )
            sub = existing.scalar_one_or_none()
            if sub:
                sub.user_id = user_id
                sub.p256dh = p256dh
                sub.auth = auth
                sub.user_agent = user_agent
                await session.commit()
                return sub.id

            sub = PushSubscription(
                user_id=user_id,
                endpoint=endpoint,
                p256dh=p256dh,
                auth=auth,
                user_agent=user_agent,
            )
            session.add(sub)
            await session.commit()
            return sub.id

    @staticmethod
    async def unsubscribe(user_id: int, endpoint: str) -> None:
        async with async_session() as session:
            await session.execute(
                delete(PushSubscription).where(
                    PushSubscription.user_id == user_id,
                    PushSubscription.endpoint == endpoint,
                )
            )
            await session.commit()

    @staticmethod
    async def send_to_user(
        user_id: int,
        title: str,
        message: str,
        url: str = '/notifications',
        data: Optional[dict] = None,
    ) -> int:
        """
        Шлёт push на все активные подписки пользователя.
        Молча игнорирует 410/404 и удаляет «протухшие» подписки.
        Возвращает количество успешных отправок.
        """
        if not is_configured():
            return 0

        async with async_session() as session:
            res = await session.execute(
                select(PushSubscription).where(PushSubscription.user_id == user_id)
            )
            subs = res.scalars().all()

        if not subs:
            return 0

        payload = json.dumps({
            'title': title,
            'body': message or '',
            'url': url,
            'data': data or {},
        })

        def _send_one(sub_endpoint: str, sub_p256dh: str, sub_auth: str) -> tuple[bool, Optional[int]]:
            try:
                webpush(
                    subscription_info={
                        'endpoint': sub_endpoint,
                        'keys': {'p256dh': sub_p256dh, 'auth': sub_auth},
                    },
                    data=payload,
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={'sub': settings.VAPID_SUBJECT},
                    timeout=10,
                )
                return True, None
            except WebPushException as exc:  # type: ignore[misc]
                status_code = getattr(getattr(exc, 'response', None), 'status_code', None)
                if status_code not in (404, 410):
                    logger.warning('Web push failed: %s', exc)
                return False, status_code
            except Exception as exc:  # pragma: no cover
                logger.warning('Web push unexpected error: %s', exc)
                return False, None

        sent = 0
        dead_endpoints: list[str] = []
        for sub in subs:
            ok, status_code = await asyncio.to_thread(
                _send_one, sub.endpoint, sub.p256dh, sub.auth,
            )
            if ok:
                sent += 1
            elif status_code in (404, 410):
                dead_endpoints.append(sub.endpoint)

        if dead_endpoints:
            try:
                async with async_session() as session:
                    await session.execute(
                        delete(PushSubscription).where(
                            PushSubscription.endpoint.in_(dead_endpoints)
                        )
                    )
                    await session.commit()
            except Exception:
                pass

        return sent
