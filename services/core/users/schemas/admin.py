from pydantic import BaseModel, HttpUrl, computed_field, Field, field_validator
from typing import Optional, Dict, Any, Union, List, Literal, Type
from users.enums import ModelRoles
from shared.schemas.base import SListMeta
import re

class SUserFilters(BaseModel):
    role: Optional[ModelRoles] = Field(None, )
    is_active: Optional[bool] = Field(None, )


class CurrentAdminData(BaseModel):
   id: int
   role: str
   telegram_id: Optional[int] = Field(None, )
   telegram_username: str
   first_name: Optional[str] = Field(None, )
   last_name: Optional[str] = Field(None, )
   photo_url: Optional[str] = Field(None, )

   class Config:
       from_attributes = True

class SUserListPartial(BaseModel):
    id: int
    role: str
    telegram_id: Optional[int] = Field(None, )
    telegram_username: Optional[str] = Field(None, )
    first_name: Optional[str] = Field(None, )
    last_name: Optional[str] = Field(None, )
    photo_url: Optional[str] = Field(None, )

    @computed_field
    @property
    def telegram_url(self,) -> str:
        return f'https://t.me/{self.telegram_username}'

    class Config:
        from_attributes = True

class SUserList(BaseModel):
    meta: Union[SListMeta, Dict]
    response: List[Optional[SUserListPartial]]

    @staticmethod
    @field_validator('meta', mode='before')
    def meta_serialize(value: Dict):
        return SListMeta(**value)


# USERNAME_REGEX = re.compile(r'^[A-Za-z0-9_]{5,32}$')
# class SRoleApply(BaseModel):
#     id: int
#     role: Roles
# telegram_username: str = Field(USERNAME_REGEX, description="Telegram username without leading @")

# @classmethod
# @field_validator('telegram_username', mode='before')
# def validate_telegram_username(cls, v: str) -> str:
#     if v.startswith('@'):
#         v = v[1:]
#     if not USERNAME_REGEX.fullmatch(v):
#         raise ValueError(
#             'telegram_username must be 5–32 chars, letters, digits or underscores only'
#         )
#     return v
