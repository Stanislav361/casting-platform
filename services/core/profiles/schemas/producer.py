from pydantic import BaseModel, Field, EmailStr, model_validator, computed_field
from dateutil.relativedelta import relativedelta
from typing import Optional, List
from datetime import datetime, date
from profiles.enums import Qualification, HairLength, HairColor, LookType, Gender, ImageType
from cities.schemas import SCityData

class SActorImage(BaseModel):
    id: int
    photo_url: str
    image_type: ImageType
    created_at: datetime

    class Config:
        from_attributes = True

class SActorData(BaseModel):
    id: int

    first_name: Optional[str] = Field(None, )
    last_name: Optional[str] = Field(None, )
    gender: Optional[Gender] = Field(None, )
    date_of_birth: Optional[date] = Field(None, exclude=True)
    age: Optional[int] = Field(None, )
    city: Optional[SCityData] = Field(None, )
    qualification: Optional[Qualification] = Field(None)
    experience: Optional[int] = Field(None,)
    about_me: Optional[str] = Field(None, )

    look_type: Optional[LookType] = Field(None,)
    hair_color: Optional[HairColor] = Field(None,)
    hair_length: Optional[HairLength] = Field(None,)
    height: Optional[float] = Field(None,)
    clothing_size: Optional[float] = Field(None,)
    shoe_size: Optional[float] = Field(None, )

    bust_volume: Optional[float] = Field(None, )
    waist_volume: Optional[float] = Field(None, )
    hip_volume: Optional[float] = Field(None, )

    video_intro: Optional[str] = Field(None, )

    images: Optional[List[SActorImage]] = Field(None, )

    @model_validator(mode='after') # noqa
    @classmethod
    def compute_age(cls, values):
        if values.date_of_birth:
            values.age = relativedelta(date.today(), values.date_of_birth).years
        return values

    class Config:
        from_attributes = True