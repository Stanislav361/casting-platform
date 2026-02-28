from pydantic import BaseModel, EmailStr, ValidationError, Field, field_validator, model_validator
# from pydantic.types import
from typing import Optional, Literal, Union
import phonenumbers
from phonenumbers import geocoder
# from src.exceptions import BaseAppException
class STmaAuthData(BaseModel):
    init_str: str


class SUserData(BaseModel):
    telegram_id: int = Field(..., alias='id') # noqa
    telegram_username: str = Field(..., alias='username')
    first_name: Optional[str] = Field(None, max_length=50, )
    last_name: Optional[str] = Field(None, max_length=50, )
    photo_url: Optional[str] = Field(None, )

class SUserDataAfterAuth(SUserData):
    is_active: Optional[bool] = Field(True, )

class SAdminAuthData(BaseModel):
    id: int = Field(..., description='telegram_id')
    first_name: Optional[str] = Field(None, max_length=50)
    last_name: Optional[str] = Field(None, max_length=50)
    username: Optional[str] = Field(None, max_length=50)
    photo_url: Optional[str] = Field(None, )
    auth_date: Optional[int] = Field(None, )
    hash: str


class SUpdateAdminDataAfterAuth(BaseModel):
    telegram_id: int = Field(..., alias='id')
    is_active: bool = Field(default=True, )
    telegram_username: str = Field(..., alias='username')
    first_name: Optional[str] = Field(None, max_length=50,)
    last_name: Optional[str] = Field(None, max_length=50,)
    photo_url: Optional[str] = Field(None, )

class SAdminData(BaseModel):
    id: int = Field(..., )
    role: str = Field(..., )
    telegram_username: str = Field(..., )
    name: Optional[str] = Field(None, max_length=50)
    lastname: Optional[str] = Field(None, max_length=50)
    photo_url: Optional[str] = Field(None, )

    class Config:
        from_attributes = True


class TokenData(BaseModel):

    id: str
    profile_id: Optional[str] = Field(None)
    role: str
    expire: float

    @field_validator('id', mode='before', check_fields=False) # noqa
    @classmethod
    def convert_id_to_str(cls, v):
        return str(v)

    @field_validator('profile_id', mode='before', check_fields=False) # noqa
    @classmethod
    def convert_profile_id_to_str(cls, v):
        return str(v)


class SJWTData(TokenData):
    pass

class SRefreshTokenData(TokenData):
    pass
