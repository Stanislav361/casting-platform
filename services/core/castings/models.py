from sqlalchemy import Column, Integer, BigInteger, Time, String, ForeignKey, TIMESTAMP, Text, CheckConstraint, Boolean, UniqueConstraint
from sqlalchemy import Enum
from sqlalchemy.dialects.postgresql import INT4RANGE, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from postgres.database import Base
from castings.enums import CastingStatusEnum

class Casting(Base):
    __tablename__ = 'castings'

    id = Column(Integer, primary_key=True, unique=True, nullable=False, autoincrement=True)
    owner_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    title = Column(String(length=100), nullable=False)
    description = Column(Text(), nullable=False)
    image_counter = Column(Integer, nullable=False, default=0)
    status = Column(Enum(CastingStatusEnum), default=CastingStatusEnum.unpublished, nullable=False)
    is_archived = Column(Boolean, nullable=False, default=False, server_default='false', index=True)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False,
                        default=lambda: datetime.now(timezone.utc),)

    parent_project_id = Column(Integer, ForeignKey('castings.id', ondelete='CASCADE'), nullable=True, index=True)
    published_by_id = Column(Integer, ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)

    city = Column(String(150), nullable=True)
    project_category = Column(String(50), nullable=True)
    role_types = Column(JSONB, nullable=True)
    gender = Column(String(100), nullable=True)
    age_from = Column(Integer, nullable=True)
    age_to = Column(Integer, nullable=True)
    financial_conditions = Column(String(255), nullable=True)
    shooting_dates = Column(String(255), nullable=True)

    published_by = relationship('User', foreign_keys=[published_by_id], lazy='joined')
    image = relationship('CastingImage', back_populates='casting', cascade='all, delete-orphan', lazy='joined')
    post = relationship('TelegramPost', back_populates='casting', uselist=False, cascade="all, delete-orphan",
                        lazy='joined')
    responses = relationship('Response', back_populates='casting',)


    __table_args__ = (
        CheckConstraint('image_counter <= 1', name='max_images_constraint'),
        CheckConstraint('image_counter >= 0', name='min_images_constraint'),
    )


class CastingImage(Base):
    __tablename__ = 'casting_images'

    id = Column(Integer, primary_key=True, unique=True, nullable=False, autoincrement=True)
    parent_id = Column(Integer, ForeignKey('castings.id', ondelete='CASCADE'), nullable=False, )
    photo_url = Column(String, nullable=False)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False,
                        default=lambda: datetime.now(timezone.utc), )

    casting = relationship("Casting", back_populates="image")


class TelegramPost(Base):
    __tablename__ = 'casting_posts'

    id = Column(Integer, primary_key=True, unique=True, nullable=False, autoincrement=True)
    casting_id = Column(Integer, ForeignKey('castings.id', ondelete='CASCADE'), nullable=False, unique=True)
    chat_id = Column(BigInteger, nullable=False, )
    message_id = Column(BigInteger, nullable=False, )
    post_url = Column(String, nullable=False, )
    published_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, ) # published_at == created_at
    closed_at = Column(TIMESTAMP(timezone=True), index=True, nullable=True)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False,
                        default=lambda: datetime.now(timezone.utc), )

    casting = relationship("Casting", back_populates="post")


class ProjectCollaborator(Base):
    __tablename__ = 'project_collaborators'

    id = Column(Integer, primary_key=True, autoincrement=True)
    casting_id = Column(Integer, ForeignKey('castings.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    role = Column(String(20), nullable=False, server_default='editor')
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (
        UniqueConstraint('casting_id', 'user_id', name='uq_collab_casting_user'),
    )
