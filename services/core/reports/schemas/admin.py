from typing import Any, Optional, List, Dict, Union, Literal
from pydantic import BaseModel, field_validator, Field, computed_field, model_validator, HttpUrl, validator
from reports.schemas.base import SBaseReportActorsSorts, SBaseReportActorsFilters, SBaseReportActorsList
from castings.schemas.admin import SCastingImageData
from shared.schemas.base import SListMeta, BaseSorts, BaseFilters
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from profiles.schemas.admin import SActorList, SActorImage
from profiles.enums import Qualification, HairLength, HairColor, LookType, Gender, ImageType
from cities.schemas import SCityData


class SCastingData(BaseModel):
    title: Optional[str] = Field(None, )
    # responses: List[Optional[_SCastingResponses]] = Field(None, exclude=True)

    class Config:
        from_attributes = True

class SReportCreate(BaseModel):
    title: str
    casting_id: int
    # actors_id: List[int]

class SReportEdit(BaseModel):
    title: str

class SFullReportEdit(BaseModel):
    title: Optional[str] = Field(default=None, )
    link: Optional[str] = Field(default=None, )


class SActorsDataForReport(BaseModel):
    actors_id: List[int]


class SWidgetReportData(BaseModel):
    id: Optional[int] = Field(None)
    title: Optional[str] = Field(None, )
    public_id: Optional[str] = Field(None, )
    casting_id: Optional[int] = Field(None)
    casting_title: Optional[str] = Field(None, )
    actors_via_casting: Optional[int] = Field(None)
    actors_without_casting: Optional[int] = Field(None)

    class Config:
        from_attributes = True

class SResponse(BaseModel):
    id: int
    profile_id: int
    video_intro: Optional[str] = Field(None, )
    casting_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class SReportActorListPartial(BaseModel):
    id: int
    via_casting: bool
    phone_number: Optional[str] = Field(None, )
    email: Optional[str] = Field(None, )
    first_name: Optional[str] = Field(None, )
    last_name: Optional[str] = Field(None, )
    city: Optional[SCityData] = Field(None, )
    age: Optional[int] = Field(None, )
    gender: Optional[Gender] = Field(None, )
    qualification: Optional[Qualification] = Field(None)
    experience: Optional[int] = Field(None,)

    look_type: Optional[LookType] = Field(None,)
    hair_color: Optional[HairColor] = Field(None,)
    hair_length: Optional[HairLength] = Field(None,)

    height: Optional[float] = Field(None, )
    clothing_size: Optional[float] = Field(None, )
    shoe_size: Optional[float] = Field(None, )

    bust_volume: Optional[float] = Field(None, )
    waist_volume: Optional[float] = Field(None, )
    hip_volume: Optional[float] = Field(None, )
    video_intro: Optional[str] = Field(None, )

    images: Optional[List[SActorImage]] = Field(None, exclude=True)
    telegram_username: Optional[str] = Field(None, exclude=True)
    date_of_birth: Optional[date] = Field(None, exclude=True)
    responses: Optional[List[SResponse]] = Field(None, exclude=True)


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

    @computed_field
    @property
    def telegram_url(self,) -> str:
        username = self.telegram_username
        return f'https://t.me/{username}'

    @computed_field
    @property
    def response_at(self) -> Optional[datetime]:
        if self.responses and len(self.responses) == 1:
            return self.responses[0].created_at
        return None

    class Config:
        from_attributes = True
        arbitrary_types_allowed = True


class SReportActorsList(SBaseReportActorsList):
    response: List[Optional[SReportActorListPartial]]

    # @model_validator(mode="after")
    # @classmethod
    # def sort_by_response_at(cls, values):
    #     # Сортируем список: элементы с response_at=None в конец
    #     if values.response:
    #         # Используем ключ: True для None, False для всех остальных
    #         values.response.sort(key=lambda x: x.response_at is None)
    #     return values



class SReportActorsListIds(SActorList):
    response: List[Optional[Union[int, dict]]]
    meta: Any = Field(None, exclude=True)

    @field_validator('response', mode='before',)
    @classmethod
    def reload_response(cls, value: Union[int, dict]):
        return [row.get('id') for row in value]


class SFullReportData(SWidgetReportData):
    actors: Optional[SReportActorsList] = None

class SReportActorsFilters(SBaseReportActorsFilters):
    via_casting: Optional[bool] = Field(None, )


class SReportActorsSorts(SBaseReportActorsSorts):
    pass


class SReportListPartial(BaseModel):
    id: int
    title: str
    casting_id: int
    casting_title: str
    actors_via_casting: int
    actors_without_casting: int
    public_id: Optional[str] = Field(None, )
    created_at: datetime
    images: Optional[List[SCastingImageData]] = Field(None, exclude=True)

    @computed_field
    @property
    def image(self) -> Union[SCastingImageData, Dict]:
        if self.images:
            return self.images[0]
        return {}

class SReportList(BaseModel):
    meta: Union[SListMeta, Dict]
    response: List[Optional[SReportListPartial]]

    class Config:
        arbitrary_types_allowed = True

    @staticmethod
    @field_validator("meta", mode="before")
    def meta_serialize(value: Dict):
        return SListMeta(**value)


class SReportFilters(BaseFilters):
    casting_id: Optional[int] = Field(None)
    min_created_at: Optional[date] = Field(None)
    max_created_at: Optional[date] = Field(None)

SortByField = Literal[
    'title',
    'created_at',
]
class SReportSorts(BaseSorts):
    sort_by: Optional[Literal[SortByField]] = Field(default="created_at")
    sort_order: Optional[Literal["asc", "desc"]] = Field(default="asc")
