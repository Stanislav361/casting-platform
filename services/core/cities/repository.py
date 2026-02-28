from shared.repository.base.repository import BaseRepository
from cities.models import City
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Select
from typing import Tuple, List, Optional
from sqlalchemy import select, asc, bindparam, desc, or_, case
from cities.util import CityListQueryUtil
from cities.schemas import SCitySorts, SCityFilters

class CitiesRepository(BaseRepository):

    model = City
    actor_lst_util = CityListQueryUtil()


    @classmethod
    async def search(
            cls,
            session: AsyncSession,
            search: Optional[str],
            page_number: int,
            page_size: int
    ) -> Tuple[List[Optional[City]], Select]:

        start_stmt = select(City)
        execute_stmt, stmt_for_meta = cls.actor_lst_util.generate_list_query(
            start_query=start_stmt,
            search=search,
            filters=SCityFilters(),
            sort_criteria=SCitySorts(),
            page_size=page_size,
            page_number=page_number,
        )
        return (await session.execute(execute_stmt)).unique().scalars().all(), stmt_for_meta # noqa