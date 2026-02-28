"""
Схемы данных для Actor Profile CRUD.
"""
from pydantic import BaseModel, Field, EmailStr, HttpUrl, model_validator, computed_field
from typing import Optional, List, Union, Dict
from datetime import date, datetime
from shared.schemas.base import SListMeta


# ─── Media Asset ───

class SMediaAsset(BaseModel):
    id: int
    file_type: str
    original_url: str
    processed_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    width: Optional[int] = None
    height_px: Optional[int] = None
    duration_sec: Optional[int] = None
    sort_order: int = 0
    is_primary: bool = False

    class Config:
        from_attributes = True


# ─── Actor Profile ───

class SActorProfileCreate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=200)
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    gender: Optional[str] = Field(None)
    date_of_birth: Optional[date] = Field(None)
    phone_number: Optional[str] = Field(None, max_length=20)
    email: Optional[EmailStr] = Field(None)
    city: Optional[str] = Field(None, max_length=200)

    qualification: Optional[str] = Field(None, max_length=50)
    experience: Optional[int] = Field(None)
    about_me: Optional[str] = Field(None, max_length=3000)

    look_type: Optional[str] = Field(None, max_length=50)
    hair_color: Optional[str] = Field(None, max_length=50)
    hair_length: Optional[str] = Field(None, max_length=50)
    height: Optional[int] = Field(None)
    clothing_size: Optional[str] = Field(None, max_length=20)
    shoe_size: Optional[str] = Field(None, max_length=20)

    bust_volume: Optional[int] = Field(None)
    waist_volume: Optional[int] = Field(None)
    hip_volume: Optional[int] = Field(None)
    video_intro: Optional[str] = Field(None, max_length=500)

    @model_validator(mode='before')
    def strip_strings(cls, values):  # noqa
        modify_fields = ['first_name', 'last_name', 'display_name']
        if isinstance(values, dict):
            for key, value in values.items():
                if isinstance(value, str):
                    value = value.strip()
                    if key in modify_fields:
                        value = value.title()
                    values[key] = value
        return values


class SActorProfileUpdate(SActorProfileCreate):
    """Частичное обновление профиля."""
    pass


class SActorProfileData(BaseModel):
    id: int
    user_id: int
    display_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None

    qualification: Optional[str] = None
    experience: Optional[int] = None
    about_me: Optional[str] = None

    look_type: Optional[str] = None
    hair_color: Optional[str] = None
    hair_length: Optional[str] = None
    height: Optional[int] = None
    clothing_size: Optional[str] = None
    shoe_size: Optional[str] = None

    bust_volume: Optional[int] = None
    waist_volume: Optional[int] = None
    hip_volume: Optional[int] = None
    video_intro: Optional[str] = None

    trust_score: int = 0
    is_active: bool = True

    media_assets: List[SMediaAsset] = []

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SActorProfileListItem(BaseModel):
    id: int
    display_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    qualification: Optional[str] = None
    is_active: bool = True
    primary_photo: Optional[str] = None

    class Config:
        from_attributes = True


class SActorProfileList(BaseModel):
    meta: Union[SListMeta, Dict]
    profiles: List[SActorProfileListItem]


class SActorProfileSwitchList(BaseModel):
    """Список профилей для Switch Profile UI."""
    profiles: List[SActorProfileListItem]
    current_profile_id: Optional[int] = None


