from reports.repositories.utils.base import BaseReportActorListQueryUtil
from sqlalchemy import nullslast
from typing import Optional
from sqlalchemy.sql.selectable import Select
from shared.repository.base.utils import ExtraListQuery
from reports.repositories.utils.base import ReportAliased
from reports.schemas.admin import SReportActorsFilters, SReportActorsSorts


reports = ReportAliased.reports
profile_reports = ReportAliased.profile_reports
profiles = ReportAliased.profiles
responses = ReportAliased.responses
casting = ReportAliased.casting

class ProducerReportActorListQueryUtil(BaseReportActorListQueryUtil):
    def filter_query_generate(
            self,
            query: Select,
            filters: SReportActorsFilters,
            extra: Optional[ExtraListQuery] = None,
    ) -> Select:
        query = super().filter_query_generate(query=query, filters=filters)
        if filters.favorite is not None:
            return query.filter(profile_reports.favorite == filters.favorite) # noqa
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
