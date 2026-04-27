"""
Season 04: Smart CRM Models.

4.1 Workflow: Event-driven notifications
4.2 Trust Score
4.3 Blacklist Engine
4.4 Collaboration: Action_Log + micro-chat
"""
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, TIMESTAMP, Text, Index
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from postgres.database import Base
import enum


class NotificationType(enum.Enum):
    STATUS_CHANGE = 'status_change'
    NEW_RESPONSE = 'new_response'
    CASTING_PUBLISHED = 'casting_published'
    CASTING_CLOSED = 'casting_closed'
    PROFILE_VIEWED = 'profile_viewed'
    SHORTLIST_ADDED = 'shortlist_added'
    SUBSCRIPTION_PURCHASED = 'subscription_purchased'
    SYSTEM = 'system'


class NotificationChannel(enum.Enum):
    IN_APP = 'in_app'
    EMAIL = 'email'
    TELEGRAM = 'telegram'


class BanType(enum.Enum):
    TEMPORARY = 'temporary'
    PERMANENT = 'permanent'


class Notification(Base):
    """4.1 Event-driven уведомления."""
    __tablename__ = 'notifications'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    type = Column(SQLEnum(NotificationType), nullable=False)
    channel = Column(SQLEnum(NotificationChannel), nullable=False, default=NotificationChannel.IN_APP)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)

    related_casting_id = Column(Integer, ForeignKey('castings.id', ondelete='SET NULL'), nullable=True)
    related_profile_id = Column(Integer, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index('ix_notifications_user_unread', 'user_id', 'is_read'),
    )


class TrustScoreLog(Base):
    """4.2 Лог расчёта Trust Score."""
    __tablename__ = 'trust_score_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)  # 'audition_attended', 'profile_completed', 'response_sent'
    points = Column(Integer, nullable=False, default=0)
    description = Column(String(300), nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class Blacklist(Base):
    """4.3 Blacklist Engine."""
    __tablename__ = 'blacklist'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    # DB migration stores this as VARCHAR, not PostgreSQL ENUM.
    ban_type = Column(String(20), nullable=False)
    reason_log = Column(Text, nullable=False)
    banned_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)

    starts_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)  # null for permanent

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index('ix_blacklist_user_active', 'user_id', 'is_active'),
    )


class ActorReview(Base):
    """4.5 Actor rating & reviews (Yandex-Taxi style)."""
    __tablename__ = 'actor_reviews'

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    reviewer = relationship("User", foreign_keys=[reviewer_id])

    __table_args__ = (
        Index('ix_actor_reviews_profile', 'profile_id', 'created_at'),
    )


class PushSubscription(Base):
    """Web Push subscriptions for browser/PWA notifications."""
    __tablename__ = 'push_subscriptions'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index('ix_push_subscriptions_user', 'user_id'),
    )


class ActionLog(Base):
    """4.4 Collaboration: Action_Log + micro-chat с тегированием."""
    __tablename__ = 'action_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    casting_id = Column(Integer, ForeignKey('castings.id', ondelete='CASCADE'), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    action_type = Column(String(50), nullable=False)  # 'comment', 'status_change', 'tag', 'system'
    message = Column(Text, nullable=True)
    tagged_user_ids = Column(Text, nullable=True)  # comma-separated user IDs

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        Index('ix_action_logs_casting', 'casting_id', 'created_at'),
    )
