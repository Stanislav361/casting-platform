from shared.repository.base.utils import TemplateListQueryUtil, ExtraListQuery
from sqlalchemy.sql.selectable import Select
from sqlalchemy import select, asc, bindparam, desc, or_, case, Case
from profiles.schemas.admin import *
from shared.schemas.base import RangeFilter
from typing import Tuple
from cities.models import City
from cities.schemas import SCitySorts, SCityFilters

class CityListQueryUtil(TemplateListQueryUtil[City, RangeFilter, SCityFilters, SCitySorts],):
    model = City
    f_range = RangeFilter

    def search_query_generate(
        self,
        start_stmt: Select,
        query: Optional[str] = None,
    ) -> Tuple[Select, Optional[Case]]:

        if query:
            relevance = case(
                (
                    City.name.ilike(f"{query}%"), 3
                ),
                (
                    City.region.ilike(f"{query}%"), 2
                ),
                (
                    City.full_name.ilike(f"%{query}%"), 1
                ),
                else_=0
            )

            search_stmt = (
                select(City)
                .where(
                    or_(
                        City.name.ilike(f"{query}%"),
                        City.region.ilike(f"{query}%"),
                        City.full_name.ilike(f"%{query}%"),
                    )
                )
            )
            return search_stmt, relevance

        return start_stmt, None

    def filter_query_generate(
            self,
            query: Select,
            filters: SCityFilters
    ) -> Select:
        return query



    def sort_query_generate(
            self,
            query: Select,
            sort_criteria: SCitySorts,
            relevance: Case
    ) -> Select:
        if relevance is not None:
            return query.order_by(desc(relevance), asc(City.name))
        return query.order_by(asc(City.name))


    def generate_list_query(
            self,
            filters: SCityFilters,
            sort_criteria: SCitySorts,
            start_query: Select,
            page_size: int,
            page_number: int,
            search: Optional[str] = None,
            extra: Optional[ExtraListQuery] = None,
    ) -> Tuple[Select, Select]:

        search_query, relevance = self.search_query_generate(start_stmt=start_query, query=search) # noqa
        filter_query = self.filter_query_generate(query=search_query, filters=filters)
        sort_query = self.sort_query_generate(query=filter_query, sort_criteria=sort_criteria, relevance=relevance)
        paginate_query = self.paginate_query_generate(query=sort_query, page_size=page_size, page_number=page_number)

        return paginate_query, filter_query