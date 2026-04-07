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
    parent_project_id: Optional[int] = None
    response_count: int = 0
    sub_castings_count: int = 0
    collaborator_count: int = 0
    team_size: int = 1
    report_count: int = 0
    image_url: Optional[str] = None
    published_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class SProjectList(BaseModel):
    projects: List[SProjectData]
    total: int


class SMediaAsset(BaseModel):
    id: int
    file_type: str
    original_url: str
    processed_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_primary: bool = False


class SRespondentProfile(BaseModel):
    """Анкета актёра (полная) для работодателя."""
    profile_id: int
    response_id: Optional[int] = None
    response_status: str = "pending"
    actor_profile_id: Optional[int] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    city: Optional[str] = None
    age: Optional[int] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    qualification: Optional[str] = None
    experience: Optional[int] = None
    about_me: Optional[str] = None
    look_type: Optional[str] = None
    hair_color: Optional[str] = None
    hair_length: Optional[str] = None
    height: Optional[float] = None
    clothing_size: Optional[str] = None
    shoe_size: Optional[str] = None
    bust_volume: Optional[float] = None
    waist_volume: Optional[float] = None
    hip_volume: Optional[float] = None
    video_intro: Optional[str] = None
    trust_score: int = 0
    photo_url: Optional[str] = None
    media_assets: List[SMediaAsset] = []
    responded_at: datetime
    self_test_url: Optional[str] = None
    avg_rating: Optional[float] = None
    review_count: int = 0


class SRespondentsList(BaseModel):
    respondents: List[SRespondentProfile]
    total: int
    project_title: str


class SActorResponseCreate(BaseModel):
    casting_id: int
    self_test_url: Optional[str] = None


class SAgentBulkResponseCreate(BaseModel):
    casting_id: int
    profile_ids: List[int]


class SResponseActorItem(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    primary_photo: Optional[str] = None
    city: Optional[str] = None
    gender: Optional[str] = None


class SActorResponse(BaseModel):
    id: int
    casting_id: int
    casting_title: str
    casting_description: Optional[str] = None
    casting_status: str
    response_status: str = "pending"
    self_test_url: Optional[str] = None
    casting_created_at: Optional[datetime] = None
    image_url: Optional[str] = None
    actor_status: Optional[str] = None
    actor_status_label: Optional[str] = None
    actors: List[SResponseActorItem] = []
    responded_at: datetime


class SActorResponseHistory(BaseModel):
    responses: List[SActorResponse]
    total: int


class SResponseStatusUpdate(BaseModel):
    status: str
