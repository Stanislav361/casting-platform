"""
Employer Schemas — проекты работодателя и отклики актёров.
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class SProjectCreate(BaseModel):
    title: str
    description: str


class SProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class SProjectData(BaseModel):
    id: int
    title: str
    description: str
    status: str
    owner_id: int
    response_count: int = 0
    created_at: datetime
    updated_at: datetime


class SProjectList(BaseModel):
    projects: List[SProjectData]
    total: int


class SRespondentProfile(BaseModel):
    """Анкета актёра (только чтение) для работодателя."""
    profile_id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    gender: Optional[str] = None
    city: Optional[str] = None
    age: Optional[int] = None
    qualification: Optional[str] = None
    experience: Optional[int] = None
    about_me: Optional[str] = None
    photo_url: Optional[str] = None
    responded_at: datetime


class SRespondentsList(BaseModel):
    respondents: List[SRespondentProfile]
    total: int
    project_title: str


class SActorResponseCreate(BaseModel):
    casting_id: int
    self_test_url: Optional[str] = None


class SActorResponse(BaseModel):
    id: int
    casting_id: int
    casting_title: str
    casting_status: str
    self_test_url: Optional[str] = None
    responded_at: datetime


class SActorResponseHistory(BaseModel):
    responses: List[SActorResponse]
    total: int
