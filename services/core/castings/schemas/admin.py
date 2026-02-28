from pydantic import BaseModel, Field, HttpUrl, field_validator, computed_field, model_validator, ValidationError
from typing import Optional, List, Text, Union, Dict, Literal
from datetime import datetime, timezone, date
from shared.schemas.base import SListMeta, BaseSorts, BaseFilters
from dateutil.relativedelta import relativedelta
from castings.enums import CastingStatusEnum
from profiles.schemas.admin import SUser, SActorImage
from bs4 import BeautifulSoup
from profiles.enums import Qualification, HairLength, HairColor, LookType, Gender, ImageType
from cities.schemas import SCityData
from profiles.schemas.admin import (
    SActorListPartial,
    SActorSorts,
    SActorFilters,
    SResponse,
)


class SCastingPostData(BaseModel):
    id: int
    chat_id: int
    message_id: int
    post_url: str
    published_at: Optional[datetime] = Field(None, )
    closed_at: Optional[datetime] = Field(None, )
    created_at: Optional[datetime] = Field(None, )

    class Config:
        from_attributes = True


class _SCastingResponses(BaseModel):
    id: int

    class Config:
        from_attributes = True


class BaseCastingData(BaseModel):
    post: Optional[SCastingPostData] = Field(None, exclude=True)
    responses: List[Optional[_SCastingResponses]] = Field(None, exclude=True)

    @computed_field
    @property
    def published_at(self) -> Optional[datetime]:
        if self.post and self.post.published_at:
            return self.post.published_at
        return None

    @computed_field
    @property
    def closed_at(self) -> Optional[datetime]:
        if self.post and self.post.closed_at:
            return self.post.closed_at
        return None

    @computed_field
    @property
    def response_quantity(self) -> int:
        if self and self.responses:
            return len(self.responses)
        return 0

    @computed_field
    @property
    def post_url(self) -> Optional[str]:
        if self and self.post:
            return self.post.post_url
        return None

    class Config:
        from_attributes = True


class SCastingFullImageData(BaseModel):
    id: int
    parent_id: int
    photo_url: str

    class Config:
        from_attributes = True

class SCastingImageData(BaseModel):
    id: int
    photo_url: str

    class Config:
        from_attributes = True


ALLOWED_TAGS = {"b", "strong", "i", "em", "u", "s", "strike", "del", "code", "pre", "a", "span", 'br', 'p',}

class SCreateCasting(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., max_length=10**4)

    @model_validator(mode="before") # noqa
    @classmethod
    def validate_html(cls, values):
        if not isinstance(values, dict):
            values = {"description": values}

        desc = values.get("description")
        if desc is None:
            return values

        if isinstance(desc, (bytes, bytearray)):
            desc = desc.decode("utf‑8", errors="ignore")
            values["description"] = desc # noqa

        soup = BeautifulSoup(desc, "html.parser")

        for tag in soup.find_all(True):
            if tag.name not in ALLOWED_TAGS:
                raise ValueError(f"Недопустимый тег: <{tag.name}>")

            if tag.name == "a" and not tag.get("href"):
                raise ValueError("Тег <a> должен содержать атрибут href")

            if tag.name == "span":
                cls_attr = tag.get("class")
                allowed_span_classes = {"tg-spoiler", }
                if not cls_attr or not set(cls_attr).issubset(allowed_span_classes):
                    raise ValueError('Тег <span> допустим только с class="tg-spoiler"')

            for attr in tag.attrs:
                allowed_attrs_a_tag = {"href", "rel", "target"}
                if tag.name == "a" and attr in allowed_attrs_a_tag:
                    continue
                allowed_attrs_span_tag = {"class",}
                if tag.name == "span" and attr in allowed_attrs_span_tag:
                    continue
                raise ValueError(f"Недопустимый атрибут '{attr}' в теге <{tag.name}>")

        return values


class SCastingEditData(SCreateCasting):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=10**4)


class SCastingData(BaseCastingData):
    id: int
    title: str
    description: Text
    status: CastingStatusEnum
    image: List[Optional[SCastingImageData]]
    created_at: Optional[datetime]


class SCastingPostCreate(BaseModel):
    casting_id: int
    message_id: int
    chat_id: int
    post_url: str


class SCastingListPartial(BaseCastingData):
    id: int
    title: str
    image: List[Optional[SCastingImageData]]
    status: CastingStatusEnum
    created_at: Optional[datetime]

class SCastingList(BaseModel): # noqa
    meta: Union[SListMeta, Dict]
    response: List[Optional[SCastingListPartial]]

    @staticmethod
    @field_validator("meta", mode="before")
    def meta_serialize(value: Dict):
        return SListMeta(**value)


class SCastingFilters(BaseFilters):
    status: Optional[CastingStatusEnum] = Field(None, )
    min_created_at: Optional[date] = Field(None)
    max_created_at: Optional[date] = Field(None)
    min_published_at: Optional[date] = Field(default=None, description='Опубликованы от:')
    max_published_at: Optional[date] = Field(default=None, description='Опубликованы до:')


SortByField = Literal[
    'title',
    'created_at',
    'published_at',
]

class SCastingSorts(BaseSorts):
    sort_by: Optional[Literal[SortByField]] = Field(default="created_at")
    sort_order: Optional[Literal["asc", "desc"]] = Field(default="asc")


class SResponsesListPartial(SActorListPartial):
    responses: List[SResponse] = Field(None, exclude=True)

    @computed_field
    @property
    def response_at(self) -> Optional[datetime]:
        if self.responses and len(self.responses) == 1:
            return self.responses[0].created_at
        return None


    # @computed_field
    # @property
    # def self_test_url(self) -> Optional[str]:
    #     if self.responses and len(self.responses) == 1:
    #         return self.responses[0].video_intro
    #     return None
    #
    # class Config:
    #     from_attributes = True


class SResponseList(BaseModel):
    meta: Union[SListMeta, Dict]
    response: List[Optional[SResponsesListPartial]]

    @staticmethod
    @field_validator("meta", mode="before")
    def meta_serialize(value: Dict):
        return SListMeta(**value)


class SResponseFilters(SActorFilters):
    pass

ResponseSortByField = Literal[
    'age',
    'experience',
    'height',
    'clothing_size',
    'shoe_size',
    'bust_volume',
    'waist_volume',
    'hip_volume',
    'created_at',
    'response_at'
]

class SResponseSorts(BaseSorts):
    sort_by: Optional[Literal[ResponseSortByField]] = Field(default='response_at')
    sort_order: Optional[Literal['asc', 'desc']] = Field(default='asc')

    @model_validator(mode='after')
    def convert_age_sorting(self):
        if self.sort_by == "age":
            new_sort_field = "date_of_birth"
            object.__setattr__(self, "sort_by", new_sort_field)
            new_order = "desc" if self.sort_order == "asc" else "asc"
            object.__setattr__(self, "sort_order", new_order)
        return self
