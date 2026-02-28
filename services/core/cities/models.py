from sqlalchemy import Column, String, Integer, Index, UniqueConstraint
from sqlalchemy.orm import relationship

from postgres.database import Base


class City(Base):
    __tablename__ = 'cities'
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False, index=True)
    region = Column(String, nullable=False, index=True)
    full_name = Column(String, nullable=False, unique=True)

    profile = relationship("Profile", back_populates="city", )
