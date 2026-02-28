from sqlalchemy.sql.selectable import Select
from sqlalchemy import and_, not_, nullslast, or_, func
from profiles.models import Profile
from profiles.schemas.admin import *
from shared.repository.base.utils import TemplateListQueryUtil, ExtraListQuery
from castings.schemas.admin import SCastingFilters, SCastingSorts
from castings.models import Casting
from shared.schemas.base import RangeFilter
from typing import Tuple
from profiles.enums import SearchFields


class ActorListQueryUtil(TemplateListQueryUtil[Profile, RangeFilter, SActorFilters, SActorSorts],):
    model = Profile
    f_range = RangeFilter

    def search_query_generate(
        self,
        start_stmt: Select,
        query: Optional[str] = None,
    ) -> Select:
        if query:
            conditions = [
                or_(
                    getattr(self.model, field.value).ilike(f"{query}%"),
                    getattr(self.model, field.value).ilike(f"%{query}%"),
                )
                for field in SearchFields
            ]
            concat_condition = func.concat_ws(
                ' ',
                *[getattr(self.model, field.value) for field in SearchFields]
            ).ilike(f"%{query}%")
            return start_stmt.where(or_(*conditions, concat_condition))

        return start_stmt

    def filter_query_generate(
            self,
            query: Select,
            filters: SActorFilters
    ) -> Select:

        static_filters = {k: v for k, v in {
            'gender': filters.gender,
            'qualification': filters.qualification,
            'look_type': filters.look_type,
            'hair_color': filters.hair_color,
            'hair_length': filters.hair_length,
            "city_full": filters.city,
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
                conditions.append(getattr(self.model, column) >= rang.min)
            if rang.max:
                conditions.append(getattr(self.model, column) <= rang.max)
            if conditions:
                filter_ranges_criteria.append(and_(*conditions))

        query = query.filter(*filter_ranges_criteria)

        for key, value in static_filters.items():
            query = query.filter(getattr(self.model, key) == value) # noqa

        query = query.filter(self.model.first_name.isnot(None))

        return query

    def sort_query_generate(
            self,
            query: Select,
            sort_criteria: SActorSorts
    ) -> Select:
        sort_by, order_ = getattr(self.model, str(sort_criteria.sort_by)), sort_criteria.order
        return query.order_by(nullslast(order_(sort_by)))


    def generate_list_query(
            self,
            start_query: Select,
            filters: SActorFilters,
            sort_criteria: SActorSorts,
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

def get_casting_list_query_class():
    from castings.repositories.utils.admin import CastingListQueryUtil
    return CastingListQueryUtil


class ActorResponseListQueryUtil(
    get_casting_list_query_class(),
):
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
            extra=extra,
        )




