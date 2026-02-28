from reports.repositories.types.base import BaseReportsRepository
from reports.repositories.utils.producer import ProducerReportActorListQueryUtil
from reports.models import ProfilesReports
from sqlalchemy import update
from profiles.models import Profile
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Tuple
from reports.schemas.admin import *
from sqlalchemy.sql.selectable import Select
from reports.schemas.producer import SReportActorsFilters, SReportActorsSorts
from shared.repository.base.utils import ExtraListQuery


class ProducerReportRepository(BaseReportsRepository):
    report_actors_lst_util = ProducerReportActorListQueryUtil()

    @classmethod
    async def delete_favorite(
            cls,
            session: AsyncSession,
            report_id: int,
            profile_id: int,
            favorite_predicate: bool,
    ) -> None:
        try:
            stmt = (
            update(ProfilesReports)
            .where(
                ProfilesReports.report_id == report_id,
                ProfilesReports.profile_id == profile_id
            )
            .values(
                favorite=favorite_predicate,
            )
            )
            await session.execute(stmt)

        except Exception as e:
            raise e


    @classmethod
    async def full_delete_favorite(
            cls,
            session: AsyncSession,
            report_id: int,
    ) -> None:
        try:
            stmt = (
            update(ProfilesReports)
            .where(
                ProfilesReports.report_id == report_id,
            )
            .values(
                favorite=False,
            )
            )
            await session.execute(stmt)

        except Exception as e:
            raise e

    @classmethod
    async def get_actors(
            cls,
            session: AsyncSession,
            report_id: int,
            in_report: bool,
            page_size: Optional[int]=None,
            page_number: Optional[int] = None,
            filters: Optional[SReportActorsFilters] = None,
            sort_criteria: Optional[SReportActorsSorts] = None,
            search: Optional[str] = None,
    ) -> Tuple[List[Union[int, Optional[Profile]]], Select]:

        start_stmt, response_subq = await super().get_actors(
            session=session,
            report_id=report_id,
            in_report=in_report,
            page_size=page_size,
            page_number=page_number,
            filters=filters,
            sort_criteria=sort_criteria,
            search=search,
        )

        execute_stmt, stmt_for_meta = cls.report_actors_lst_util.generate_list_query(
            start_query=start_stmt,
            search=search,
            filters=filters,
            sort_criteria=sort_criteria,
            page_size=page_size,
            page_number=page_number,
            extra=ExtraListQuery(
                filter={'report_id': report_id}, sort={'response_subq': response_subq}
            ),
        )
        return (await session.execute(execute_stmt)).mappings().all(), stmt_for_meta  # noqa
