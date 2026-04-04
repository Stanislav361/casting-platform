"""
Subscription Service — управление подписками Админ / АдминПРО.

Подписка "Админ" (employer) — кастинги + только откликнувшиеся актёры.
Подписка "АдминПРО" (employer_pro) — кастинги + ВСЕ актёры + шорт-листы из любых.
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from sqlalchemy import select, Column, Integer, String, ForeignKey, TIMESTAMP, Boolean
from sqlalchemy.orm import relationship

from postgres.database import Base, async_session_maker as async_session
from users.models import User
from users.enums import ModelRoles, SubscriptionType


class Subscription(Base):
    __tablename__ = 'subscriptions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    plan = Column(String(length=50), nullable=False)  # 'admin' or 'admin_pro'
    is_active = Column(Boolean, nullable=False, default=True)
    starts_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", foreign_keys=[user_id])


PLAN_TO_ROLE = {
    SubscriptionType.ADMIN.value: ModelRoles.employer,
    SubscriptionType.ADMIN_PRO.value: ModelRoles.employer_pro,
}


class SubscriptionService:

    @staticmethod
    async def activate_subscription(user_id: int, plan: str, days: int = 30) -> dict:
        """Активировать подписку и обновить роль пользователя."""
        if plan not in [s.value for s in SubscriptionType]:
            raise ValueError(f"Unknown plan: {plan}. Available: {[s.value for s in SubscriptionType]}")

        new_role = PLAN_TO_ROLE[plan]

        async with async_session() as session:
            user = await session.get(User, user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")

            now = datetime.now(timezone.utc)
            sub = Subscription(
                user_id=user_id,
                plan=plan,
                is_active=True,
                starts_at=now,
                expires_at=now + timedelta(days=days),
            )
            session.add(sub)

            user.role = new_role
            session.add(user)
            await session.commit()

            try:
                from crm.service import NotificationService
                from crm.models import NotificationType
                plan_label = "Админ ПРО" if plan == "admin_pro" else "Админ"
                user_name = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip() or user.email or f"User #{user_id}"
                await NotificationService.notify_superadmins(
                    type=NotificationType.SUBSCRIPTION_PURCHASED,
                    title="Новая подписка",
                    message=f"💳 {user_name} купил подписку «{plan_label}» на {days} дней.",
                )
            except Exception:
                pass

            return {
                "user_id": user_id,
                "plan": plan,
                "role": new_role.value,
                "expires_at": str(sub.expires_at),
                "days": days,
            }

    @staticmethod
    async def get_subscription(user_id: int) -> Optional[dict]:
        async with async_session() as session:
            result = await session.execute(
                select(Subscription)
                .where(Subscription.user_id == user_id, Subscription.is_active == True)
                .order_by(Subscription.created_at.desc())
                .limit(1)
            )
            sub = result.scalar_one_or_none()
            if not sub:
                return None

            now = datetime.now(timezone.utc)
            is_expired = sub.expires_at < now

            return {
                "plan": sub.plan,
                "is_active": sub.is_active and not is_expired,
                "starts_at": str(sub.starts_at),
                "expires_at": str(sub.expires_at),
                "is_expired": is_expired,
            }

    @staticmethod
    async def deactivate_expired():
        """Деактивировать истёкшие подписки и понизить роль до user."""
        async with async_session() as session:
            now = datetime.now(timezone.utc)
            result = await session.execute(
                select(Subscription).where(
                    Subscription.is_active == True,
                    Subscription.expires_at < now,
                )
            )
            expired = result.scalars().all()
            count = 0
            for sub in expired:
                sub.is_active = False
                session.add(sub)

                user = await session.get(User, sub.user_id)
                if user and user.role.value in ['employer', 'employer_pro']:
                    user.role = ModelRoles.user
                    session.add(user)
                count += 1

            await session.commit()
            return count
