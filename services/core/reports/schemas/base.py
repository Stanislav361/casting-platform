from profiles.schemas.admin import SActorSorts, SActorFilters
from profiles.schemas.admin import SActorList
from typing import Optional, List
from shared.schemas.base import SListMeta, BaseSorts, BaseFilters
from pydantic import model_validator, Field
from typing import Literal

class SBaseReportActorsList(SActorList):
    pass

class SBaseReportActorsFilters(SActorFilters):
    pass


ReportActorsSortByField = Literal[
    'age',
    'experience',
    'height',
    'clothing_size',
    'shoe_size',
    'bust_volume',
    'waist_volume',
    'hip_volume',
    'created_at',
    'response_at'
]

class SBaseReportActorsSorts(BaseSorts):
    sort_by: Optional[Literal[ReportActorsSortByField]] = Field(default='response_at')
    sort_order: Optional[Literal['asc', 'desc']] = Field(default='asc')

    @model_validator(mode='after')
    def convert_age_sorting(self):
        if self.sort_by == "age":
            new_sort_field = "date_of_birth"
            object.__setattr__(self, "sort_by", new_sort_field)
            new_order = "desc" if self.sort_order == "asc" else "asc"
            object.__setattr__(self, "sort_order", new_order)
        return self
