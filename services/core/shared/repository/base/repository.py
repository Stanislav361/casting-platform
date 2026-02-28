import math
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Select

class BaseRepository:
    model = None

    @classmethod
    async def get_meta(
        cls,
        session: AsyncSession,
        query,
        page_number,
        page_size: int,
    ) -> dict:

        total_rows = await cls._get_total_rows(
            session=session,
            query=query,
        )
        meta_dict = {
            "current_page": page_number,
            "total_pages": math.ceil(total_rows / page_size) if page_size > 0 else 1,
            "total_rows": total_rows,
        }
        return meta_dict


    @classmethod
    async def _get_total_rows(
            cls,
            session: AsyncSession,
            query
    ) -> int:
        sub_query = query.subquery()
        stmt_count = select(func.count()).select_from(sub_query)
        return (await session.execute(stmt_count)).scalar_one()
