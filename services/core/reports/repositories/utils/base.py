from castings.models import Casting, CastingImage
from profiles.models import Response, Profile, ProfileImages
from users.models import User
from cities.models import City
from sqlalchemy.orm import aliased
from shared.schemas.base import RangeFilter
from reports.models import Report, ProfilesReports
from reports.schemas.base import SBaseReportActorsSorts, SBaseReportActorsFilters
from sqlalchemy.sql.selectable import Select
from sqlalchemy import or_, and_, nullslast, func, select
from typing import Optional, Tuple
from profiles.enums import SearchFields as ActorSearchFields
from profiles.repositories.utils.admin import ActorListQueryUtil
from shared.repository.base.utils import ExtraListQuery
from sqlalchemy.orm import RelationshipProperty

class ReportAliased:
    reports = aliased(Report)
    profile_reports = aliased(ProfilesReports)
    profiles = aliased(Profile)
    profile_images = aliased(ProfileImages)
    responses = aliased(Response)
    casting = aliased(Casting)
    casting_images = aliased(CastingImage)
    user = aliased(User)
    city = aliased(City)

reports = ReportAliased.reports
profile_reports = ReportAliased.profile_reports
profiles = ReportAliased.profiles
responses = ReportAliased.responses
casting = ReportAliased.casting


class BaseReportActorListQueryUtil(ActorListQueryUtil):
    model = profiles
    f_range = RangeFilter

    def search_query_generate(
        self,
        start_stmt: Select,
        query: Optional[str] = None,
    ) -> Select:
        if query:
            conditions = [
                or_(
                    getattr(profiles, field.value).ilike(f"{query}%"),
                    getattr(profiles, field.value).ilike(f"%{query}%"),
                )
                for field in ActorSearchFields
            ]
            concat_condition = func.concat_ws(
                ' ',
                *[getattr(profiles, field.value) for field in ActorSearchFields]
            ).ilike(f"%{query}%")
            return start_stmt.where(or_(*conditions, concat_condition))

        return start_stmt

    def filter_query_generate(
            self,
            query: Select,
            filters: SBaseReportActorsFilters
    ) -> Select:
        if filters:
            static_filters = {k: v for k, v in {
                'gender': filters.gender,
                'qualification': filters.qualification,
                'look_type': filters.look_type,
                'hair_color': filters.hair_color,
                'hair_length': filters.hair_length,
                'city_full': filters.city,
            }.items() if v is not None}

            range_filters = {
                'date_of_birth': self.f_range(min=filters.min_date_of_birth, max=filters.max_date_of_birth),
                'experience': self.f_range(min=filters.min_experience, max=filters.max_experience),
                'height': self.f_range(min=filters.min_height, max=filters.max_height),
                'clothing_size': self.f_range(min=filters.min_cloth, max=filters.max_cloth),
                'shoe_size': self.f_range(min=filters.min_shoe, max=filters.max_shoe),
                'bust_volume': self.f_range(min=filters.min_bust, max=filters.max_bust),
                'waist_volume': self.f_range(min=filters.min_waist, max=filters.max_waist),
                'hip_volume': self.f_range(min=filters.min_hip, max=filters.max_hip),
            }

            filter_ranges_criteria = []
            for column, rang in range_filters.items():
                conditions = []
                if rang.min:
                    conditions.append(getattr(profiles, column) >= rang.min)
                if rang.max:
                    conditions.append(getattr(profiles, column) <= rang.max)
                if conditions:
                    filter_ranges_criteria.append(and_(*conditions))

            query = query.filter(*filter_ranges_criteria)

            for key, value in static_filters.items():
                query = query.filter(getattr(profiles, key) == value) # noqa
            if filters.city is not None:
                query = query.filter(profiles.city.has(full_name=filters.city))
            query = query.filter(profiles.first_name.isnot(None)) # noqa
        return query

    def sort_query_generate(
            self,
            query: Select,
            sort_criteria: SBaseReportActorsSorts
    ) -> Select:
        if sort_criteria:
            sort_by, order_ = getattr(profiles, str(sort_criteria.sort_by)), sort_criteria.order
            return query.order_by(nullslast(order_(sort_by)))
        return query


    def generate_list_query(
            self,
            start_query: Select,
            filters: SBaseReportActorsFilters,
            sort_criteria: SBaseReportActorsSorts,
            page_size: Optional[int] = None,
            page_number: Optional[int] = None,
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