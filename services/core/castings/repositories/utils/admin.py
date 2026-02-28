from profiles.repositories.utils.admin import ActorListQueryUtil
from shared.repository.base.utils import TemplateListQueryUtil, ExtraListQuery
from castings.schemas.admin import SResponseFilters, SResponseSorts
from sqlalchemy.sql.selectable import Select
from sqlalchemy import and_, or_, not_, nullslast
from typing import Tuple, Optional
from castings.schemas.admin import SCastingFilters, SCastingSorts
from castings.models import Casting, TelegramPost
from shared.schemas.base import RangeFilter
from castings.enums import SearchFields, CastingStatusEnum
from castings.schemas.admin import SResponseSorts
from profiles.models import Response

class CastingListQueryUtil(TemplateListQueryUtil[Casting, RangeFilter, SCastingFilters, SCastingSorts]):

    model = Casting
    f_range = RangeFilter

    def search_query_generate(
        self,
        start_stmt: Select,
        query: Optional[str] = None,
    ) -> Select:

        if query:
            return start_stmt.where(
                or_(
                    *(getattr(self.model, field.value).ilike(f"%{query}%") for field in SearchFields)
                )
            )
        return start_stmt


    def filter_query_generate(
            self,
            query: Select,
            filters: SCastingFilters
    ) -> Select:

        conditions = []

        if filters.status is not None:
            if filters.status is CastingStatusEnum.not_closed:
                conditions.append(Casting.status != CastingStatusEnum.closed)
            else:
                conditions.append(Casting.status == filters.status)

        if filters.min_created_at or filters.max_created_at:
            if filters.min_created_at:
                conditions.append(
                    Casting.created_at >= filters.min_created_at
                )
            if filters.max_created_at:
                conditions.append(
                    Casting.created_at <= filters.max_created_at
                )

        if filters.min_published_at or filters.max_published_at:
            if filters.min_published_at:
                conditions.append(
                    TelegramPost.published_at >= filters.min_published_at
                )
            if filters.max_published_at:
                conditions.append(
                    TelegramPost.published_at <= filters.max_published_at
                )

        if conditions:
            return query.filter(and_(*conditions))
        return query


    def sort_query_generate(
            self,
            query: Select,
            sort_criteria: SCastingSorts
    ) -> Select:
        model_by_sort = TelegramPost if sort_criteria.sort_by == 'published_at' else Casting
        sort_by, order = getattr(model_by_sort, str(sort_criteria.sort_by)), sort_criteria.order
        return query.order_by(nullslast(order(sort_by)))


    def generate_list_query(
        self,
        start_query: Select,
        filters: SCastingFilters,
        sort_criteria: SCastingSorts,
        page_size: int,
        page_number: int,
        search: Optional[str] = None,
        extra: Optional[ExtraListQuery] = None,
    ) -> Tuple[Select, Select]:

        return super().generate_list_query(
            start_query=start_query,
            filters=filters,
            sort_criteria=sort_criteria,
            page_size=page_size,
            page_number=page_number,
            search=search,
            extra=extra,
        )


class CastingResponsesListQueryUtil(
    ActorListQueryUtil,
    TemplateListQueryUtil[Casting, RangeFilter, SCastingFilters, SCastingSorts],
):
    def sort_query_generate(
            self,
            query: Select,
            sort_criteria: SResponseSorts
    ) -> Select:
        if sort_criteria.sort_by == 'response_at':
            sort_by, order_ = Response.created_at, sort_criteria.order
            return query.order_by(nullslast(order_(sort_by)))
        sort_by, order_ = getattr(self.model, str(sort_criteria.sort_by)), sort_criteria.order
        return query.order_by(nullslast(order_(sort_by)))

    def generate_list_query(
        self,
        start_query: Select,
        filters: SResponseFilters,
        sort_criteria: SResponseSorts,
        page_size: int,
        page_number: int,
        search: Optional[str] = None,
        extra: Optional[ExtraListQuery] = None,
    ) -> Tuple[Select, Select]:

        return super().generate_list_query(
            start_query=start_query,
            search=search,
            filters=filters,
            sort_criteria=sort_criteria,
            page_size=page_size,
            page_number=page_number,
            extra=extra,
        )
