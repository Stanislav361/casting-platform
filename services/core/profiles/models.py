from sqlalchemy import Column, Integer, String, ForeignKey, Date, JSON
from sqlalchemy import Index, UniqueConstraint, TIMESTAMP, Text
from sqlalchemy import Enum as SQLEnum, Numeric, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from postgres.database import Base
from profiles.enums import Qualification, LookType, HairColor, HairLength, Gender, ImageType

class Profile(Base):
    __tablename__ = 'profiles'

    id = Column(Integer, primary_key=True, unique=True, nullable=False, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), unique=True, index=True, )

    first_name = Column(String(length=100), index=True, nullable=True)
    last_name = Column(String(length=100), index=True, nullable=True)
    gender = Column(SQLEnum(Gender), index=True, nullable=True)
    date_of_birth = Column(Date, index=True, nullable=True)
    phone_number = Column(String(length=12), nullable=True, unique=True)
    email = Column(String(length=255), nullable=True, unique=True)
    city_full = Column(String, ForeignKey('cities.full_name', ), nullable=True)
    qualification = Column(SQLEnum(Qualification), nullable=True)
    experience = Column(Integer, index=True, nullable=True)
    about_me = Column(Text, nullable=True)

    look_type = Column(SQLEnum(LookType), nullable=True)
    hair_color = Column(SQLEnum(HairColor), nullable=True)
    hair_length = Column(SQLEnum(HairLength), nullable=True)
    height = Column(Numeric(5, 2), index=True, nullable=True)
    clothing_size = Column(Numeric(5, 2), index=True, nullable=True)
    shoe_size = Column(Numeric(5, 2), index=True, nullable=True)

    bust_volume = Column(Numeric(5, 2), index=True, nullable=True)
    waist_volume = Column(Numeric(5, 2), index=True, nullable=True)
    hip_volume = Column(Numeric(5, 2), index=True, nullable=True)
    video_intro = Column(String(), nullable=True)

    image_counter = Column(Integer, index=True, nullable=False, default=0)

    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False,
                        default=lambda: datetime.now(timezone.utc),)

    user = relationship("User", back_populates="profile", )
    responses = relationship('Response', back_populates='profile', )
    city = relationship("City", back_populates="profile", )

    images = relationship(
        'ProfileImages',
        back_populates='profile',
        cascade="all, delete-orphan",
        lazy="joined"
    )

    __table_args__ = (
        Index('ix_surname_name_lastname', 'first_name', 'last_name', ),
        CheckConstraint('image_counter <= 6', name='max_images_constraint'),
        CheckConstraint('image_counter >= 0', name='min_images_constraint'),
    )


class ProfileImages(Base):
    __tablename__ = 'profile_images'

    id = Column(Integer, primary_key=True, unique=True, nullable=False, autoincrement=True)
    parent_id = Column(Integer, ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False, )
    photo_url = Column(String, nullable=False)
    crop_photo_url = Column(String, nullable=False)
    coordinates = Column(JSON, nullable=False)
    image_type = Column(SQLEnum(ImageType, name='image_type', native_enum=True), nullable=False,)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False,
                        default=lambda: datetime.now(timezone.utc), )

    profile = relationship("Profile", back_populates="images")


class Response(Base):
    __tablename__ = 'profile_responses'

    id = Column(Integer, primary_key=True, unique=True, nullable=False, autoincrement=True)
    profile_id = Column(Integer, ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False, index=True)
    self_test_url = Column(String, nullable=True)
    casting_id = Column(Integer, ForeignKey('castings.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    # updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False,
    #                     default=lambda: datetime.now(timezone.utc), )

    __table_args__ = (
        UniqueConstraint('profile_id', 'casting_id', name='uq_profile_id_casting_id'),
    )

    profile = relationship("Profile", back_populates="responses", lazy='joined')
    casting = relationship("Casting", back_populates="responses", )