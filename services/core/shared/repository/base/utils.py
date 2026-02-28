from sqlalchemy.sql.selectable import Select
from abc import ABC, abstractmethod
from pydantic import BaseModel
from postgres.database import Base
from typing import TypeVar, Tuple, Optional, Generic
from shared.schemas.base import BaseFilters, BaseSorts

class ExtraListQuery(BaseModel):
    search: Optional[str] = None
    filter: Optional[dict] = None
    sort: Optional[dict] = None


F = TypeVar("F", bound=BaseFilters)   # фильтры
S = TypeVar("S", bound=BaseSorts)

M = TypeVar("M", bound=Base)
R = TypeVar("R", bound=BaseModel)


class TemplateListQueryUtil(Generic[M, R, F, S], ABC):

    model: M
    f_range: R

    @staticmethod
    def paginate_query_generate(
            query: Select,
            page_size: int,
            page_number: int
    ) -> Select:
        if page_number is not None and page_number is not None:
            return query.offset((page_number - 1) * page_size).limit(page_size)
        return query

    @abstractmethod
    def search_query_generate(self, *args, **kwargs) -> Select: ...

    @abstractmethod
    def filter_query_generate(self, *args, **kwargs) -> Select: ...

    @abstractmethod
    def sort_query_generate(self, *args, **kwargs) -> Select: ...

    def generate_list_query(
            self,
            start_query: Select,
            filters: F,
            sort_criteria: S,
            page_size: int,
            page_number: int,
            search: Optional[str] = None,
            extra: Optional[ExtraListQuery] = None,
    ) -> Tuple[Select, Select]:

        search_query = self.search_query_generate(
            start_stmt=start_query,
            query=search,
            **({'extra': extra} if extra and extra.search else {})
        )
        filter_query = self.filter_query_generate(
            query=search_query,
            filters=filters,
            **({'extra': extra.filter} if extra and extra.filter else {})
        )
        sort_query = self.sort_query_generate(
            query=filter_query,
            sort_criteria=sort_criteria,
            **({'extra': extra.sort} if extra and extra.sort else {})
        )
        paginate_query = self.paginate_query_generate(query=sort_query, page_size=page_size, page_number=page_number)
        return paginate_query, filter_query