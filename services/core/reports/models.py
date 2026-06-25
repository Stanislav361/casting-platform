from sqlalchemy import Column, Integer, Numeric, Boolean, Time, String, ForeignKey, ARRAY, TIMESTAMP
from sqlalchemy.ext.declarative import declarative_base, declared_attr
from sqlalchemy.orm import relationship, column_property, aliased
from datetime import datetime, timezone
from postgres.database import Base
import uuid

class Report(Base):
    __tablename__ = 'reports'

    id = Column(Integer, primary_key=True, unique=True, nullable=False, autoincrement=True)
    casting_id = Column(Integer, ForeignKey('castings.id', ), unique=False, index=True, nullable=False)
    title = Column(String, nullable=False, unique=False,) # TODO
    public_id = Column(String, nullable=False, unique=True, index=True, default=lambda: uuid.uuid4().hex)
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False,
                        default=lambda: datetime.now(timezone.utc),)
    casting = relationship('Casting', foreign_keys=[casting_id],) # noqa
    profiles_reports = relationship('ProfilesReports', back_populates='report')


class ProfilesReports(Base):
    __tablename__ = 'profiles_reports'

    id = Column(Integer, primary_key=True, unique=True, nullable=False, autoincrement=True)
    profile_id = Column(Integer, ForeignKey('profiles.id', ondelete='CASCADE'), unique=False, nullable=False)
    actor_profile_id = Column(Integer, nullable=True, index=True)
    report_id = Column(Integer, ForeignKey('reports.id', ondelete='CASCADE'), unique=False, nullable=False)
    favorite = Column(Boolean, default=False, nullable=False)
    review_status = Column(String, default='new', nullable=False, server_default='new')
    created_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(TIMESTAMP(timezone=True), onupdate=lambda: datetime.now(timezone.utc), nullable=False,
                        default=lambda: datetime.now(timezone.utc),)
    profile = relationship("Profile", primaryjoin='ProfilesReports.profile_id == Profile.id',)
    report = relationship("Report", primaryjoin='ProfilesReports.report_id == Report.id', back_populates='profiles_reports')
