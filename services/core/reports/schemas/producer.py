from typing import Any, Optional, List, Dict, Union, Literal
from pydantic import BaseModel, field_validator, Field, computed_field, model_validator, HttpUrl, validator
from reports.schemas.base import SBaseReportActorsSorts, SBaseReportActorsFilters, SBaseReportActorsList
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from profiles.schemas.admin import SActorList, SActorImage
from profiles.enums import ImageType
from cities.schemas import SCityData

class SReportActorListPartial(BaseModel):
    id: int
    first_name: Optional[str] = Field(None, )
    last_name: Optional[str] = Field(None, )
    city: Optional[SCityData] = Field(None, )
    age: Optional[int] = Field(None, )

    height: Optional[float] = Field(None, )
    clothing_size: Optional[float] = Field(None, )
    shoe_size: Optional[float] = Field(None, )

    video_intro: Optional[str] = Field(None, )
    favorite: Optional[bool] = Field(None, )

    images: Optional[List[SActorImage]] = Field(None, exclude=True)
    date_of_birth: Optional[date] = Field(None, exclude=True)

    @model_validator(mode="after")  # noqa
    @classmethod
    def compute_age(cls, values):
        if values.date_of_birth:
            values.age = relativedelta(date.today(), values.date_of_birth).years
        return values

    @computed_field
    @property
    def image(self) -> Union[SActorImage, Dict]:
        if self.images:
            portrait_image = [image for image in self.images if image.image_type == ImageType.portrait]
            if portrait_image:
                return portrait_image[0]
            return self.images[0]
        return {}

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True

class SReportActorsList(SBaseReportActorsList):
    response: List[Optional[SReportActorListPartial]]

class SExtraReportData(BaseModel):
    id: Optional[int] = Field(None)
    title: Optional[str] = Field(None, )
    updated_at: Optional[datetime] = Field(None, )

    class Config:
        from_attributes = True


class SFullReportData(SExtraReportData):
    actors: Optional[SReportActorsList] = None

class SReportActorsFilters(SBaseReportActorsFilters):
    favorite: Optional[bool] = Field(None, )


class SReportActorsSorts(SBaseReportActorsSorts):
    pass
