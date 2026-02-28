from pydantic import BaseModel, field_validator
from typing import Union, List, Dict, Optional
from shared.schemas.base import SListMeta

class SCityData(BaseModel):
    name: str
    region: str
    full_name: str

    class Config:
        from_attributes = True

class SCitiesListPartial(SCityData): ...


class SCitiesList(BaseModel):
    meta: Union[SListMeta, Dict]
    response: List[Optional[SCitiesListPartial]]

    @staticmethod
    @field_validator('meta', mode='before')
    def meta_serialize(value: Dict):
        return SListMeta(**value)


class SCityFilters(BaseModel):
    pass

class SCitySorts(BaseModel):
    pass