from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class SShortlistTokenCreate(BaseModel):
    report_id: int = Field(..., description="ID отчёта (шорт-листа)")
    expires_in_hours: Optional[int] = Field(None, description="Срок жизни токена в часах")
    max_views: Optional[int] = Field(None, description="Макс. количество просмотров")


class SShortlistTokenResponse(BaseModel):
    token: str
    report_id: int
    expires_at: Optional[str] = None
    max_views: Optional[int] = None


class SShortlistProfileImage(BaseModel):
    id: int
    photo_url: str
    image_type: Optional[str] = None


class SShortlistProfile(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    height: Optional[float] = None
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    qualification: Optional[str] = None
    look_type: Optional[str] = None
    images: List[SShortlistProfileImage] = []
    is_favorite: bool = False


class SShortlistViewResponse(BaseModel):
    report_id: int
    title: str
    profiles: List[SShortlistProfile] = []
    updated_at: Optional[str] = None


