from reports.repositories.utils.base import BaseReportActorListQueryUtil
from reports.models import Report
from reports.schemas.admin import SReportFilters, SReportSorts, SReportActorsFilters, SReportActorsSorts
from sqlalchemy.sql.selectable import Select
from sqlalchemy import or_, and_, nullslast, select, column, ColumnElement
from typing import Optional, Tuple
from reports.enums import SearchFields
from reports.repositories.utils.base import ReportAliased
from shared.repository.base.utils import TemplateListQueryUtil, ExtraListQuery
from shared.schemas.base import RangeFilter
from profiles.models import Response

reports = ReportAliased.reports
profile_reports = ReportAliased.profile_reports
profiles = ReportAliased.profiles
responses = ReportAliased.responses
casting = ReportAliased.casting

class AdminReportsListQueryUtil(TemplateListQueryUtil[Report, RangeFilter, SReportFilters, SReportSorts]):
    model = Report
    f_range = RangeFilter
    alias = ReportAliased()

    def search_query_generate(
        self,
        start_stmt: Select,
        query: Optional[str] = None,
    ) -> Select:

        search_field_map = {
            SearchFields.TITLE.value: reports.title,
            SearchFields.CASTING_TITLE.value: casting.title,
        }

        if query:
            return start_stmt.where(
                or_(
                    *(
                        col.ilike(f"%{query}%") # noqa
                        for col in search_field_map.values()
                    )
                )
            )
        return start_stmt


    def filter_query_generate(
            self,
            query: Select,
            filters: SReportFilters
    ) -> Select:
        conditions = []
        if filters.casting_id:
            conditions.append(
                casting.id == filters.casting_id
            )
        if filters.min_created_at or filters.max_created_at: # noqa
            if filters.min_created_at:
                conditions.append(
                    reports.created_at >= filters.min_created_at
                )
            if filters.max_created_at:
                conditions.append(
                    reports.created_at <= filters.max_created_at
                )
        if conditions:
            return query.filter(and_(*conditions))
        return query


    def sort_query_generate(
            self,
            query: Select,
            sort_criteria: SReportSorts
    ) -> Select:
        sort_by, order = getattr(reports, str(sort_criteria.sort_by)), sort_criteria.order
        return query.order_by(nullslast(order(sort_by)))


    def generate_list_query(
        self,
        start_query: Select,
        filters: SReportFilters,
        sort_criteria: SReportSorts,
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


class AdminReportActorListQueryUtil(BaseReportActorListQueryUtil):

    def filter_query_generate(
            self,
            query: Select,
            filters: SReportActorsFilters,
            extra: Optional[ExtraListQuery] = None,
    ) -> Select:
        if not extra:
            raise KeyError('set extra argument')
        report_id = extra.get('report_id')
        query = super().filter_query_generate(query=query, filters=filters)
        if getattr(filters, 'via_casting', None) is not None:
            casting_subq = select(Report.casting_id).where(Report.id == report_id).scalar_subquery()
            casting_exists_subq = (
                select(1)
                .where(
                    (Response.casting_id == casting_subq) &
                    (Response.profile_id == profiles.id)
                )
                .correlate(profiles)
                .exists()
            )
            query = query.filter(casting_exists_subq if filters.via_casting else ~casting_exists_subq)
        return query

    def sort_query_generate(self, query: Select, sort_criteria: SReportActorsSorts, extra: Optional[ExtraListQuery] = None,) -> Select:
        if sort_criteria:
            if sort_criteria.sort_by == 'response_at':
                response_subq = extra.get('response_subq')
                sort_by, order_ = response_subq.c.last_response_at, sort_criteria.order
                return query.order_by(nullslast(order_(sort_by)))
            sort_by, order_ = getattr(profiles, str(sort_criteria.sort_by)), sort_criteria.order
            return query.order_by(nullslast(order_(sort_by)))
        return query
