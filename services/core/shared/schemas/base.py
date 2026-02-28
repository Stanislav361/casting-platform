from pydantic import BaseModel, computed_field
from sqlalchemy import asc, desc
from typing import Literal, Any, Callable, Optional


class SListMeta(BaseModel):
    current_page: int
    total_pages: int
    total_rows: int

class RangeFilter(BaseModel):
    min: Any
    max: Any


class BaseFilters(BaseModel):
    class Config:
        arbitrary_types_allowed = True


class BaseSorts(BaseModel):
    sort_order: Literal['asc', 'desc'] = 'desc'

    @computed_field
    @property
    def order(self, ) -> Callable:
        return desc if self.sort_order == 'desc' else asc


    # class Config:
    #     arbitrary_types_allowed=True