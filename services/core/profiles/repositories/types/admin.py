from profiles.models import Profile, ProfileImages, Response
from sqlalchemy.dialects.postgresql import insert as PSQLinsert  # noqa
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from shared.repository.base.repository import BaseRepository
from typing import Tuple
from sqlalchemy.sql.selectable import Select
from profiles.schemas.admin import *
from castings.models import Casting
from profiles.repositories.utils.admin import ActorListQueryUtil, ActorResponseListQueryUtil
from cities.models import City

class AdminActorRepository(BaseRepository):

    model = Profile
    image_model = ProfileImages
    actor_lst_util = ActorListQueryUtil()
    casting_lst_util = ActorResponseListQueryUtil()

    @classmethod
    async def get_actor(cls, session: AsyncSession, actor_id: int) -> type(Profile):
        stmt_get = (
            select(cls.model)
            .filter_by(id=actor_id)
            .outerjoin(City, City.full_name == cls.model.city_full)
            .options(
                joinedload(cls.model.user),
                joinedload(cls.model.city),
            )
        )
        actor = (await session.execute(stmt_get)).unique().scalar_one_or_none()
        return actor

    @classmethod
    async def get_actor_list(
            cls,
            session,
            filters: SActorFilters,
            sort_criteria: SActorSorts,
            page_size: int,
            page_number: int,
            search: Optional[str]=None,
    ) -> Tuple[List[Optional[Profile]], Select]:

        start_stmt = (
                      select(cls.model)
                      .outerjoin(City, City.full_name == cls.model.city_full)
                      .options(
                          joinedload(cls.model.user),
                          joinedload(cls.model.city),
                      )
                      )
        execute_stmt, stmt_for_meta = cls.actor_lst_util.generate_list_query(
            start_query=start_stmt,
            search=search,
            filters=filters,
            sort_criteria=sort_criteria,
            page_size=page_size,
            page_number=page_number,
        )
        return (await session.execute(execute_stmt)).unique().scalars().all(), stmt_for_meta


    @classmethod
    async def get_responses_list(
        cls,
        session: AsyncSession,
        profile_id: int,
        filters: SResponsesFilters,
        sort_criteria: SResponsesSorts,
        page_size: int,
        page_number: int,

    ) -> Tuple[List[Optional[Response]], Select]:

        start_stmt = (  # noqa
            select(Response)
            .filter(Response.profile_id == profile_id)
            .join(Casting, Response.casting_id == Casting.id, isouter=True)
            .options(
                joinedload(Response.casting).joinedload(Casting.image),
                joinedload(Response.casting).joinedload(Casting.post),
                joinedload(Response.casting).joinedload(Casting.responses)
            )
        )
        execute_stmt, stmt_for_meta = cls.casting_lst_util.generate_list_query(
            start_query=start_stmt,
            filters=filters,
            sort_criteria=sort_criteria, # noqa
            page_size=page_size,
            page_number=page_number,
        )
        return (await session.execute(execute_stmt)).unique().scalars().all(), stmt_for_meta  # noqa
