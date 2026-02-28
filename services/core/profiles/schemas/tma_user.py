from pydantic import BaseModel, Field, EmailStr, field_validator, HttpUrl, model_validator
from profiles.enums import Qualification, HairLength, HairColor, LookType, Gender, ImageType
from typing import Optional, List, Union, Any
from datetime import date
import phonenumbers
from phonenumbers import geocoder
from profiles.models import Profile
from cities.schemas import SCityData
from typing_extensions import Self

class SImageCoordinatePartial(BaseModel):
    x: Union[int, float]
    y: Union[int, float]


class SImageCoordinate(BaseModel):
    top_left: Optional[SImageCoordinatePartial] = None
    bottom_right: Optional[SImageCoordinatePartial] = None

    """
    @model_validator(mode='after')
    def check_coordinates(self) -> Self:
        if self.top_left.x >= self.bottom_right.x:
            raise ValueError("top_left.x must be less than bottom_right.x")
        if self.bottom_right.y <= self.top_left.y:
            raise ValueError("bottom_right.y must be greater than top_left.y")
        return self
    """
        
class SProfileImage(BaseModel):
    id: int
    photo_url: str
    image_type: ImageType
    coordinates: SImageCoordinate

    class Config:
        from_attributes = True

class SProfileResponsePost(BaseModel):
    casting_id: int
    # self_test_url: Optional[HttpUrl] = None


class SProfileData(BaseModel):
    id: int

    first_name: Optional[str] = Field(None, )
    last_name: Optional[str] = Field(None, )
    gender: Optional[Gender] = Field(None, )
    date_of_birth: Optional[date] = Field(None)
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
    clothing_size: Optional[float] = Field(None, )
    shoe_size: Optional[float] = Field(None, )

    bust_volume: Optional[float] = Field(None, )
    waist_volume: Optional[float] = Field(None, )
    hip_volume: Optional[float] = Field(None, )
    video_intro: Optional[str] = Field(None, )

    images: Optional[List[SProfileImage]] = Field(None, )

    class Config:
        from_attributes = True


class SProfileUpdate(BaseModel):

    first_name: Optional[str] = Field(None, min_length=1, max_length=100, example='Александр')# noqa
    last_name: Optional[str] = Field(None, min_length=1, max_length=100, example='Петров')# noqa
    gender: Optional[Gender] = Field(None, )
    date_of_birth: Optional[date] = Field(None, example=f'{date(year=2001, month=12, day=12)}')# noqa
    phone_number: Optional[str] = Field(None, pattern=r"^\+79\d{9}$", example='+79889098878')# noqa
    email: Optional[EmailStr] = Field(None, min_length=2, max_length=100, example='petrov.alex@bk.ru') # noqa
    city_full: Optional[str] = Field(None, example='Москва, Москва', alias='city') # noqa
    qualification: Optional[Qualification] = Field(None, )
    experience: Optional[int] = Field(None, example=5)# noqa
    about_me: Optional[str] = Field(None, max_length=10**3, example='text') # noqa

    look_type: Optional[LookType] = Field(None, )
    hair_color: Optional[HairColor] = Field(None, )
    hair_length: Optional[HairLength] = Field(None, )

    height: Optional[float] = Field(None, )
    clothing_size: Optional[float] = Field(None, )
    shoe_size: Optional[float] = Field(None, )

    bust_volume: Optional[float] = Field(None, )
    waist_volume: Optional[float] = Field(None, )
    hip_volume: Optional[float] = Field(None, )
    video_intro: Optional[HttpUrl] = Field(None, )

    @model_validator(mode='before')
    def strip_and_capitalize(cls, values): # noqa
        modify_fields = ['first_name', 'last_name']
        for key, value in values.items():
            if isinstance(value, str):
                value = value.strip()
                if key in modify_fields:
                    value = value.lower().capitalize()
                values[key] = value
        return values

    @model_validator(mode='after')
    def convert_urls_to_str(cls, model_instance): # noqa
        for field_name, field_type in cls.model_fields.items():
            value = getattr(model_instance, field_name)
            if isinstance(value, HttpUrl):
                setattr(model_instance, field_name, str(value))
        return model_instance



    @field_validator('phone_number', mode='before', check_fields=False)  # noqa
    @classmethod
    def validate_phone_number(cls, phone_number: Optional[str]) -> Optional[str]:
        if phone_number: # noqa
            try:
                x = phonenumbers.parse(phone_number)
                if not phonenumbers.is_valid_number(x):
                    raise ValueError(f'Invalid phone number: {phone_number}')
                if geocoder.description_for_number(x, "en") != 'Russia':
                    raise ValueError(f'phone number not from Russia: {phone_number}')
                return phone_number
            except phonenumbers.phonenumberutil.NumberParseException:
                raise ValueError(f'Invalid phone number: {phone_number}')  # Invalid number format
        else:
            return None

    class Config:
        allow_population_by_field_name = True


class SFields(BaseModel):

    first_name: bool = Field(default=False, alias='Имя')
    last_name: bool = Field(default=False, alias='Фамилия')
    gender: bool = Field(default=False, alias='Пол')
    date_of_birth: bool = Field(default=False, alias='Дата Рождения')
    phone_number: bool = Field(default=False, alias='Номер телефона')
    # email: bool = Field(default=False, alias='Адрес электронной почты')
    city_full: bool = Field(default=False, alias='Город')
    qualification: bool = Field(default=False, alias='Квалификация')
    # experience: bool = Field(default=False, alias='Опыт')
    look_type: bool = Field(default=False, alias='Тип внешности')
    hair_color: bool = Field(default=False, alias='Цвет волос')
    hair_length: bool = Field(default=False, alias='Длина волос')
    height: bool = Field(default=False, alias='Рост')
    clothing_size: bool = Field(default=False, alias='Размер одежды')
    shoe_size: bool = Field(default=False, alias='Размер обуви')

    @model_validator(mode="before") # noqa
    @classmethod
    def bool_modify(cls, values: Any) -> Any:
        if isinstance(values, Profile):
            values = {
                field: bool(getattr(values, field)) for field in cls.model_fields # noqa
            }
        return values

    class Config:
        from_attributes = True
        populate_by_name = True
