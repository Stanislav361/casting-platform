from sqlalchemy import (
    Column, Integer, ForeignKey, String, DateTime, TIMESTAMP,
    CheckConstraint, BigInteger, Boolean, Text, Index
)
from sqlalchemy import Enum as SQLEnum
from datetime import datetime, timezone
from sqlalchemy.orm import relationship
from users.enums import ModelRoles

from postgres.database import Base


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, unique=True, nullable=False)
    role = Column(SQLEnum(ModelRoles), nullable=False, default=ModelRoles.user)
    is_active = Column(Boolean, nullable=False, default=False)

    # --- Telegram (optional linkage) ---
    telegram_id = Column(BigInteger(), unique=True, nullable=True)
    telegram_username = Column(String(length=100), unique=True, nullable=True)

    # --- Email / Password auth ---
    email = Column(String(length=255), unique=True, nullable=True, index=True)
    password_hash = Column(String(length=255), nullable=True)

    first_name = Column(String(length=100), nullable=True)
    last_name = Column(String(length=100), nullable=True)
    phone_number = Column(String(length=20), nullable=True)
    photo_url = Column(String(length=500), nullable=True)

    telegram_nick = Column(String(length=100), nullable=True)
    vk_nick = Column(String(length=100), nullable=True)
    max_nick = Column(String(length=100), nullable=True)
    middle_name = Column(String(length=100), nullable=True)

    # --- Employer verification (interview with SuperAdmin) ---
    is_employer_verified = Column(Boolean, nullable=False, default=False, server_default='false')

    # --- Soft delete ---
    is_deleted = Column(Boolean, nullable=False, default=False, index=True)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), default=datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    # One user → many actor profiles
    profiles = relationship("ActorProfile", back_populates="user", lazy="selectin")
    # Legacy single profile (backward compat)
    profile = relationship(
        "Profile", back_populates="user", uselist=False,
    )
    # OAuth providers (multi-provider auth)
    oauth_providers = relationship("UserOAuthProvider", back_populates="user", lazy="selectin")

    __table_args__ = (
        Index('ix_users_email_active', 'email', 'is_active'),
    )


class ActorProfile(Base):
    """
    Multi-profile: один User может владеть N профилями актёров.
    Архитектура One-to-Many.
    """
    __tablename__ = 'actor_profiles'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    display_name = Column(String(length=200), nullable=True)
    first_name = Column(String(length=100), nullable=True)
    last_name = Column(String(length=100), nullable=True)
    gender = Column(String(length=20), nullable=True)
    date_of_birth = Column(DateTime, nullable=True)
    phone_number = Column(String(length=20), nullable=True)
    email = Column(String(length=255), nullable=True)
    city = Column(String(length=200), nullable=True)

    qualification = Column(String(length=50), nullable=True)
    experience = Column(Integer, nullable=True)
    about_me = Column(Text, nullable=True)

    look_type = Column(String(length=50), nullable=True)
    hair_color = Column(String(length=50), nullable=True)
    hair_length = Column(String(length=50), nullable=True)
    height = Column(Integer, nullable=True)
    clothing_size = Column(String(length=20), nullable=True)
    shoe_size = Column(String(length=20), nullable=True)

    bust_volume = Column(Integer, nullable=True)
    waist_volume = Column(Integer, nullable=True)
    hip_volume = Column(Integer, nullable=True)
    video_intro = Column(String(length=500), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    deleted_at = Column(TIMESTAMP(timezone=True), nullable=True)

    # Admin-only internal fields (Data Isolation — hidden from external users)
    internal_notes = Column(Text, nullable=True)
    admin_rating = Column(Integer, nullable=True)

    # Trust Score (репутация)
    trust_score = Column(Integer, nullable=False, default=0)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="profiles")
    media_assets = relationship("MediaAsset", back_populates="actor_profile", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index('ix_actor_profiles_user_active', 'user_id', 'is_active'),
    )


class MediaAsset(Base):
    """
    Медиа-файлы профиля актёра (фото/видео) с метаданными обработки.
    """
    __tablename__ = 'media_assets'

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_profile_id = Column(Integer, ForeignKey('actor_profiles.id', ondelete='CASCADE'), nullable=False, index=True)

    file_type = Column(String(length=20), nullable=False)  # photo / video
    original_url = Column(String(length=500), nullable=False)
    processed_url = Column(String(length=500), nullable=True)  # resized/transcoded
    thumbnail_url = Column(String(length=500), nullable=True)

    original_filename = Column(String(length=255), nullable=True)
    mime_type = Column(String(length=100), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    width = Column(Integer, nullable=True)
    height_px = Column(Integer, nullable=True)
    duration_sec = Column(Integer, nullable=True)  # for video

    sort_order = Column(Integer, nullable=False, default=0)
    is_primary = Column(Boolean, nullable=False, default=False)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    actor_profile = relationship("ActorProfile", back_populates="media_assets")


class OTPCode(Base):
    """
    OTP коды для Email/SMS верификации.
    """
    __tablename__ = 'otp_codes'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True)
    destination = Column(String(length=255), nullable=False)  # email or phone
    destination_type = Column(String(length=20), nullable=False)  # 'email' or 'sms'
    code = Column(String(length=6), nullable=False)
    is_used = Column(Boolean, nullable=False, default=False)
    attempts = Column(Integer, nullable=False, default=0)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class ShortlistToken(Base):
    """
    SSOT: Динамические токены для шорт-листов.
    Ссылка на View, а не статичный слепок.
    """
    __tablename__ = 'shortlist_tokens'

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(length=64), unique=True, nullable=False, index=True)
    report_id = Column(Integer, ForeignKey('reports.id', ondelete='CASCADE'), nullable=False)
    created_by = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    is_active = Column(Boolean, nullable=False, default=True)
    expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    max_views = Column(Integer, nullable=True)
    view_count = Column(Integer, nullable=False, default=0)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    report = relationship("Report", foreign_keys=[report_id])


class UserOAuthProvider(Base):
    """
    Мультипровайдерная авторизация: связь User ↔ OAuth-провайдер.
    Один User может иметь несколько привязок (Telegram, VK, Email).
    """
    __tablename__ = 'user_oauth_providers'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    provider = Column(String(length=50), nullable=False)  # 'telegram', 'vk', 'email'
    provider_user_id = Column(String(length=255), nullable=False)
    provider_username = Column(String(length=255), nullable=True)
    provider_email = Column(String(length=255), nullable=True)
    provider_avatar = Column(String(length=500), nullable=True)
    access_token = Column(String(length=1000), nullable=True)
    refresh_token = Column(String(length=1000), nullable=True)
    token_expires_at = Column(TIMESTAMP(timezone=True), nullable=True)
    raw_data = Column(Text, nullable=True)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(
        TIMESTAMP(timezone=True),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    user = relationship("User", back_populates="oauth_providers")

    __table_args__ = (
        Index('ix_oauth_provider_unique', 'provider', 'provider_user_id', unique=True),
    )


class AuthPredicate(Base):
    __tablename__ = 'auth_predicates'
    id = Column(Integer, primary_key=True, unique=True, nullable=False)
    auth_predicate = Column(Boolean, nullable=False, default=True)
    type = Column(SQLEnum(ModelRoles, create_type=False), nullable=False)


class VerificationTicket(Base):
    __tablename__ = 'verification_tickets'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    status = Column(String(length=20), nullable=False, default='open')
    company_name = Column(String(length=200), nullable=True)
    about_text = Column(Text, nullable=True)
    projects_text = Column(Text, nullable=True)
    experience_text = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", foreign_keys=[user_id])
    messages = relationship("TicketMessage", back_populates="ticket", lazy="selectin", order_by="TicketMessage.created_at")


class TicketMessage(Base):
    __tablename__ = 'ticket_messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticket_id = Column(Integer, ForeignKey('verification_tickets.id', ondelete='CASCADE'), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    ticket = relationship("VerificationTicket", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


class GeneralChatMessage(Base):
    __tablename__ = 'general_chat_messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    sender = relationship("User", foreign_keys=[sender_id])


class ProjectChatMessage(Base):
    __tablename__ = 'project_chat_messages'

    id = Column(Integer, primary_key=True, autoincrement=True)
    casting_id = Column(Integer, ForeignKey('castings.id', ondelete='CASCADE'), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    message = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    sender = relationship("User", foreign_keys=[sender_id])
