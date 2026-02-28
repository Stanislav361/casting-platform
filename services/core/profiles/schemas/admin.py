from pydantic import BaseModel, Field, EmailStr, model_validator, field_validator, computed_field
from dateutil.relativedelta import relativedelta
from typing import Optional, Literal, List, Union, Dict, Callable
from datetime import datetime, date, timezone
from castings.enums import CastingStatusEnum
from shared.schemas.base import SListMeta, BaseSorts, BaseFilters
from profiles.enums import Qualification, HairLength, HairColor, LookType, Gender, ImageType
from cities.schemas import SCityData


class SActorImage(BaseModel):
    id: int
    photo_url: str
    image_type: ImageType
    created_at: datetime

    class Config:
        from_attributes = True


class SUser(BaseModel):
    telegram_username: str

    class Config:
        from_attributes = True


class SActorData(BaseModel):
    id: int

    first_name: Optional[str] = Field(None, )
    last_name: Optional[str] = Field(None, )
    gender: Optional[Gender] = Field(None, )
    date_of_birth: Optional[date] = Field(None, exclude=True)
    age: Optional[int] = Field(None, )
    phone_number: Optional[str] = Field(None, )
    email: Optional[EmailStr] = Field(None,)
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
    user: SUser = Field(None, exclude=True)

    @model_validator(mode='after') # noqa
    @classmethod
    def compute_age(cls, values):
        if values.date_of_birth:
            values.age = relativedelta(date.today(), values.date_of_birth).years
        return values

    @computed_field
    @property
    def telegram_url(self,) -> str:
        username = self.user.telegram_username
        return f'https://t.me/{username}'

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


class SActorListPartial(BaseModel):
    id: int
    phone_number: Optional[str] = Field(None, )
    email: Optional[str] = Field(None, )
    first_name: Optional[str] = Field(None, )
    last_name: Optional[str] = Field(None, )
    city: Optional[SCityData] = Field(None, )
    age: Optional[int] = Field(None, )
    gender: Optional[Gender] = Field(None, )
    qualification: Optional[Qualification] = Field(None)
    experience: Optional[int] = Field(None, )

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
    date_of_birth: Optional[date] = Field(None, exclude=True)
    user: SUser = Field(..., exclude=True)


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
        username = self.user.telegram_username
        return f'https://t.me/{username}'

    class Config:
        from_attributes = True


class SActorList(BaseModel):
    meta: Union[SListMeta, Dict]
    response: List[Optional[SActorListPartial]]

    @staticmethod
    @field_validator('meta', mode='before')
    def meta_serialize(value: Dict):
        return SListMeta(**value)


class SActorFilters(BaseFilters):

    gender: Optional[Gender] = Field(default=None, description='gender static filter')
    city: Optional[str] = Field(default=None, description='city static filter')
    qualification: Optional[Qualification] = Field(default=None, description='qualification static filter')
    look_type: Optional[LookType] = Field(default=None, description='look type static filter')
    hair_color: Optional[HairColor] = Field(default=None, description='hair color static filter')
    hair_length: Optional[HairLength] = Field(default=None, description='hair length static filter')



    min_age: Optional[int] = Field(default=1, ge=1, description='minimum age')
    max_age: Optional[int] = Field(default=100, le=100, description='maximum age')

    min_experience: Optional[int] = Field(default=None, ge=0, le=99, description='minimum experience')
    max_experience: Optional[int] = Field(default=None, ge=0, le=99, description='maximum experience')

    min_height: Optional[float] = Field(default=None, ge=0, le=300.0, description='minimum height')
    max_height: Optional[float] = Field(default=None, ge=0, le=300.0, description='maximum height')

    min_cloth: Optional[float] = Field(default=None, ge=0, le=100.0, description='maximum clothing size')
    max_cloth: Optional[float] = Field(default=None, ge=0, le=100.0, description='maximum clothing size')

    min_shoe: Optional[float] = Field(default=None, ge=0, le=100.0, description='minimum shoe size')
    max_shoe: Optional[float] = Field(default=None, ge=0, le=100.0, description='maximum shoe size')

    min_bust: Optional[float] = Field(default=None, ge=0, le=200.0, description='minimum bust volume')
    max_bust: Optional[float] = Field(default=None, ge=0, le=200.0, description='maximum bust volume')

    min_waist: Optional[float] = Field(default=None, ge=0, le=200.0, description='minimum waist volume')
    max_waist: Optional[float] = Field(default=None, ge=0, le=200.0, description='maximum waist volume')

    min_hip: Optional[float] = Field(default=None, ge=0, le=200.0, description='minimum hip volume')
    max_hip: Optional[float] = Field(default=None, ge=0, le=200.0, description='maximum hip volume')

    @computed_field
    @property
    def min_date_of_birth(self) -> Optional[date]:
        if self.min_age:
            return datetime.now(timezone.utc).date() - relativedelta(years=self.max_age + 1) + relativedelta(days=1)
        return None

    @computed_field
    @property
    def max_date_of_birth(self) -> Optional[date]:
        if self.max_age:
            return datetime.now(timezone.utc).date() - relativedelta(years=self.min_age)
        return None

    @model_validator(mode="after") # noqa
    @classmethod
    def check_ranges(cls, values):
        prefix_map = {}

        for field_name, value in values.__dict__.items():
            if field_name.startswith("min_") or field_name.startswith("max_"):
                suffix = field_name[4:]  # отрезаем `min_` или `max_`
                prefix_map.setdefault(suffix, {})[field_name[:3]] = value  # {'min': ..., 'max': ...}

        errors = []

        for suffix, range_pair in prefix_map.items():
            min_val = range_pair.get('min')
            max_val = range_pair.get('max')
            if min_val is not None and max_val is not None and min_val > max_val:
                errors.append(f"'min_{suffix}' ({min_val}) не может быть больше 'max_{suffix}' ({max_val})")

        if errors:
            raise ValueError("; ".join(errors))
        return values


ActorSortByField = Literal[
    'age',
    'experience',
    'height',
    'clothing_size',
    'shoe_size',
    'bust_volume',
    'waist_volume',
    'hip_volume',
    'created_at'
]

class SActorSorts(BaseSorts):
    sort_by: Optional[Literal[ActorSortByField]] = Field(default='created_at')
    sort_order: Optional[Literal['asc', 'desc']] = Field(default='asc')

    @model_validator(mode='after')
    def convert_age_sorting(self):
        if self.sort_by == "age":
            new_sort_field = "date_of_birth"
            object.__setattr__(self, "sort_by", new_sort_field)
            new_order = "desc" if self.sort_order == "asc" else "asc"
            object.__setattr__(self, "sort_order", new_order)
        return self


class SCastingImageData(BaseModel):
    id: int
    photo_url: str

    class Config:
        from_attributes = True

class SCastingPostData(BaseModel):
    published_at: Optional[datetime]
    closed_at: Optional[datetime]

    class Config:
        from_attributes = True

class SCastingResponse(BaseModel):
    id: int
    class Config:
        from_attributes = True


class SCastingListPartial(BaseModel):
    id: int
    title: str
    image: List[Optional[SCastingImageData]]
    status: CastingStatusEnum
    created_at: datetime = Field(..., )
    published_at: Optional[datetime] = Field(None, )
    post: Optional[SCastingPostData] = Field(None,)
    responses: List[SCastingResponse] = Field(None,)

    @computed_field
    @property
    def get_published_at(self) -> Optional[datetime]:
        if self.status == CastingStatusEnum.published:
            return self.post.published_at
        return None

    class Config:
        from_attributes = True


class SResponsesListPartial(BaseModel):
    id: Optional[int] = Field(None, )
    title: Optional[str] = Field(None, )
    status: Optional[CastingStatusEnum] = Field(None, )
    image: List[Optional[SCastingImageData]] = Field([], )
    response_quantity: Optional[int] = Field(None, )
    created_at: Optional[datetime] = Field(None, )
    published_at: Optional[datetime] = Field(None, )
    closed_at: Optional[datetime] = Field(None, )

    casting: SCastingListPartial = Field(..., exclude=True)
    post: Optional[SCastingPostData] = Field(None, exclude=True)

    @model_validator(mode="after")  # noqa
    @classmethod
    def fill_profile_data(cls, values):
        if values.casting:
            for field_name, field_value in values.casting.dict().items():
                if field_name in cls.model_fields:
                    setattr(values, field_name, field_value)
        if values.casting.post:
            for field_name, field_value in values.casting.post.dict().items():
                if field_name in cls.model_fields:
                    setattr(values, field_name, field_value)
        if values.casting.responses:
            setattr(values, 'response_quantity', len(values.casting.responses))
        return values

    class Config:
        from_attributes = True


class SResponsesList(BaseModel): # noqa
    meta: Union[SListMeta, Dict]
    response: List[Optional[SResponsesListPartial]]

    @staticmethod
    @field_validator("meta", mode="before")
    def meta_serialize(value: Dict):
        return SListMeta(**value)


def get_responses_filters():
    from castings.schemas.admin import SCastingFilters
    class SResponsesFiltersClass(SCastingFilters): ...
    return  SResponsesFiltersClass

SResponsesFilters = get_responses_filters()


ResponseSortByField = Literal[
    'title',
    'created_at',
    'updated_at'
]

class SResponsesSorts(BaseSorts):
    sort_by: Optional[Literal[ResponseSortByField]] = Field(default="created_at")
    sort_order: Optional[Literal["asc", "desc"]] = Field(default="asc")
