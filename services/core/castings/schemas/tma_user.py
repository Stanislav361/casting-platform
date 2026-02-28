from pydantic import BaseModel, Field
from typing import Optional, List, Text

class SCastingImageData(BaseModel):
    id: int
    photo_url: str

    class Config:
        from_attributes = True

class SCastingData(BaseModel):
    id: int
    title: str
    description: Text
    has_applied: Optional[bool] = Field(False, )
    image: List[Optional[SCastingImageData]]

    class Config:
        from_attributes = True


class SProfileResponse(BaseModel):
    video_intro: Optional[str] = Field(None)

    class Config:
        from_attributes = True