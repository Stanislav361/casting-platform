from pydantic import BaseModel, EmailStr, ValidationError, Field, field_validator, model_validator
from datetime import date, datetime
from typing_extensions import Annotated
from typing import Optional, Literal, Union
import phonenumbers
from phonenumbers import geocoder


# class STmaUserRegister(BaseModel):
#     init_data: str = Field(str, )
#     role: Literal['tma-user']
#     surname: str = Field(..., max_length=50, min_length=3, example='Иванов')
#     name: str = Field(..., max_length=50, min_length=3, example='Антон')
#     lastname: str = Field(..., max_length=50, min_length=3, example='Сергеевич')
#     phone_number: str = Field(..., pattern=r"^\+79\d{9}$", example='+79889098878')
#     email: EmailStr = Field(..., min_length=2, max_length=100, example='petrov.alex@bk.ru')
#
#     @field_validator('telegram_id', mode='before', check_fields=False)  # noqa
#     @classmethod
#     def replace_id_from_str(cls, telegram_id: int) -> str:
#         return str(telegram_id)
#
#     @model_validator(mode='before')
#     def modify_data(cls, values): # noqa
#         modify_data = ['surname', 'name', 'lastname']
#         for key, value in values.items(): # noqa
#             if 'may be null' in str(value):
#                 raise BaseAppException.NullableClear
#             if isinstance(value, str):
#                 values[key] = value.strip()
#                 if key in modify_data:
#                     values[key] = value.lower().capitalize().strip()
#         return values
#
#     @field_validator('phone_number', mode='before', check_fields=False)  # noqa
#     @classmethod
#     def validate_phone_number(cls, phone_number: Optional[str]) -> Optional[str]:
#         if phone_number: # noqa
#             try:
#                 x = phonenumbers.parse(phone_number)
#                 if not phonenumbers.is_valid_number(x):
#                     raise ValueError(f'Invalid phone number: {phone_number}')
#                 if geocoder.description_for_number(x, "en") != 'Russia':
#                     raise ValueError(f'phone number not from Russia: {phone_number}')
#             except phonenumbers.phonenumberutil.NumberParseException:
#                 raise ValueError(f'Invalid phone number: {phone_number}')  # Invalid number format
#         else:
#             return None
#         return phone_number
#
#     class Config:
#         from_attributes = True
#         json_schema_extra = {
#             "title": " user/auth/register",
#         }
#
#

