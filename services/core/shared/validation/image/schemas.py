from pydantic import BaseModel, Field

# class SImageData(BaseModel):
#     parent_id: int
#     image_name: str
#     photo_url: str
#     image_type: str
#
#     class Config:
#         from_attributes = True

class SImageData(BaseModel):
    id: int
    photo_url: str

    class Config:
        from_attributes = True
