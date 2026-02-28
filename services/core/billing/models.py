"""
Season 03: Биллинг-модели.

3.1 Тарификация: Basic (Project) / Pro (Global)
3.2 Биллинг-логика: подписки, cron-деактивация, Grace period
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, TIMESTAMP, Text, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from postgres.database import Base


class BillingPlan(Base):
    """Тарифные планы."""
    __tablename__ = 'billing_plans'

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(50), unique=True, nullable=False)  # 'basic', 'pro'
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price_monthly = Column(Numeric(10, 2), nullable=False, default=0)
    price_yearly = Column(Numeric(10, 2), nullable=True)

    max_projects = Column(Integer, nullable=True)  # null = unlimited
    can_search_all_actors = Column(Boolean, nullable=False, default=False)
    can_fulltext_search = Column(Boolean, nullable=False, default=False)
    can_create_shortlists = Column(Boolean, nullable=False, default=False)

    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class UserSubscription(Base):
    """Подписка пользователя с Grace Period."""
    __tablename__ = 'user_subscriptions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey('billing_plans.id'), nullable=False)
    status = Column(String(20), nullable=False, default='active')  # active, grace, expired, cancelled

    starts_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    grace_until = Column(TIMESTAMP(timezone=True), nullable=True)  # expires_at + 24h

    auto_renew = Column(Boolean, nullable=False, default=True)
    payment_method = Column(String(50), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    plan = relationship("BillingPlan", foreign_keys=[plan_id])
    user = relationship("User", foreign_keys=[user_id])
