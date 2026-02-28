from typing import TypeVar, Optional, Generic, Any
from pydantic import BaseModel
from postgres.database import transaction
from sqlalchemy.ext.asyncio import AsyncSession
from reports.repositories.types.base import BaseReportsRepository
from reports.schemas.base import SBaseReportActorsSorts, SBaseReportActorsFilters, SBaseReportActorsList

R = TypeVar("R", bound=BaseReportsRepository)
AF = TypeVar("AF", bound=SBaseReportActorsFilters)
AS = TypeVar("AS", bound=SBaseReportActorsSorts)
AR = TypeVar("AR", bound=SBaseReportActorsList)

class ActorListMixin(Generic[R, AF, AS, AR]):

    REPOSITORY: Optional[R] = None
    ACTOR_FILTERS: Optional[AF] = None
    ACTOR_SORTS: Optional[AS] = None
    ACTORS_RESPONSE: Optional[AR] = None

    @classmethod
    @transaction
    async def get_actors(
            cls,
            session: AsyncSession,
            report_id: int,
            in_report: bool,
            page_size: int,
            page_number: int,
            filters: Optional[AF],
            sort_by: Optional[AS],
            search: Optional[str],
    ) -> Any:

        actors, query = await cls.REPOSITORY.get_actors(
            session=session,
            report_id=report_id,
            in_report=in_report,
            search=search,
            filters=filters,
            sort_criteria=sort_by,
            page_size=page_size,
            page_number=page_number,
        )

        meta = await cls.REPOSITORY.get_meta(
            session=session,
            query=query,
            page_number=page_number,
            page_size=page_size,
        )
        return cls.ACTORS_RESPONSE(meta=meta, response=actors)