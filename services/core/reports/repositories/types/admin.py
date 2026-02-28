from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, delete, func, update, distinct, tuple_
from typing import Tuple
from reports.schemas.admin import *
from reports.models import Report, ProfilesReports
from sqlalchemy.sql.selectable import Select
from sqlalchemy.exc import IntegrityError
from reports.services.admin.exceptions import *
from reports.exceptions import *
from sqlalchemy.engine.row import RowMapping
from reports.repositories.utils.admin import AdminReportsListQueryUtil, AdminReportActorListQueryUtil
from reports.repositories.utils.admin import ReportAliased as Ra
from sqlalchemy import case, select, and_
from sqlalchemy.dialects.postgresql import insert as pg_insert
from reports.repositories.types.base import BaseReportsRepository
from shared.repository.base.utils import ExtraListQuery
from profiles.models import Profile
from reports.schemas.admin import SReportActorsFilters, SReportActorsSorts



reports = Ra.reports
profile_reports = Ra.profile_reports
profiles = Ra.profiles
profile_images = Ra.profile_images
responses = Ra.responses
casting = Ra.casting
casting_image = Ra.casting_images
user = Ra.user
city = Ra.city

class AdminReportsRepository(BaseReportsRepository):
    model = Report
    reports_lst_util = AdminReportsListQueryUtil()
    report_actors_lst_util = AdminReportActorListQueryUtil()

    @classmethod
    async def get_all_reports(
            cls,
            session: AsyncSession,
            filters: SReportFilters,
            sort_criteria: SReportSorts,
            page_size: int,
            page_number: int,
            search: Optional[str] = None,
    ) -> Tuple[List[RowMapping], Select]:

        images_subq = (
            select(
                casting_image.parent_id.label("casting_id"),
                func.array_agg(
                    func.jsonb_build_object(
                        "id", casting_image.id,
                        "photo_url", casting_image.photo_url,
                    )
                ).label("images")
            )
            .group_by(casting_image.parent_id)
        ).subquery()


        start_stmt = (
            select(
                reports.id.label("id"),
                reports.title.label("title"),
                reports.public_id.label("public_id"),
                reports.created_at.label("created_at"),
                casting.id.label("casting_id"),
                casting.title.label("casting_title"),
                images_subq.c.images,
                func.count(distinct(responses.profile_id)).label("actors_via_casting"),
                (func.count(distinct(profile_reports.profile_id)) - func.count(distinct(responses.profile_id))).label("actors_without_casting"),
            )
            .outerjoin(profile_reports, profile_reports.report_id == reports.id) # noqa
            .outerjoin(profiles, profiles.id == profile_reports.profile_id)
            .outerjoin(casting, casting.id == reports.casting_id)
            .outerjoin(images_subq, images_subq.c.casting_id == casting.id)
            .outerjoin(
                responses,
                and_(
                    responses.profile_id == profiles.id,
                    responses.casting_id == reports.casting_id,
                )
            )
            .group_by(
                reports.id,
                reports.public_id,
                reports.title,
                reports.created_at,
                casting.id,
                casting.title,
                images_subq.c.images
            )
        )
        execute_stmt, stmt_for_meta = cls.reports_lst_util.generate_list_query(
            search=search,
            start_query=start_stmt,
            filters=filters,
            sort_criteria=sort_criteria,
            page_size=page_size,
            page_number=page_number
        )

        return (await session.execute(execute_stmt)).mappings().all(), stmt_for_meta # noqa



    @classmethod
    async def get_actors(
            cls,
            session: AsyncSession,
            report_id: int,
            in_report: bool,
            page_size: Optional[int] = None,
            page_number: Optional[int] = None,
            filters: Optional[SReportActorsFilters] = None,
            sort_criteria: Optional[SReportActorsSorts] = None,
            search: Optional[str] = None,
    ) -> Tuple[List[Union[int, Optional[Profile]]], Select]:

        start_stmt, response_subq = await super().get_actors( # noqa
            session=session,
            report_id=report_id,
            in_report=in_report,
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

        # print(stmt_for_meta.compile())
        return (await session.execute(execute_stmt)).mappings().all(), stmt_for_meta  # noqa



    @classmethod
    async def get_actors_id(
            cls,
            session: AsyncSession,
            report_id: int,
            in_report: bool,
            filters: Optional[SReportActorsFilters] = None,
            sort_criteria: Optional[SReportActorsSorts] = None,
            search: Optional[str] = None,
    ) -> Tuple[List[int], Select]:

        # start_stmt = (
        #     select(
        #         profiles.id,
        #     )
        #     .outerjoin(profile_reports, profile_reports.profile_id == profiles.id,) # noqa
        #     .outerjoin(responses, responses.profile_id == profiles.id,)
        #     .outerjoin(reports, reports.id == profile_reports.report_id,)
        #     .group_by(
        #         profiles.id,
        #     )
        # )
        #
        # if in_report:
        #     start_stmt = start_stmt.where(profile_reports.report_id == report_id)
        # execute_stmt, stmt_for_meta = cls.report_actors_lst_util.generate_list_query(
        #     start_query=start_stmt,
        #     search=search,
        #     filters=filters,
        #     sort_criteria=sort_criteria,
        #     extra=ExtraListQuery(filter={'report_id': report_id}),
        # )

        return await cls.get_actors(
            session=session,
            report_id=report_id,
            in_report=in_report,
            filters=filters,
            sort_criteria=sort_criteria,
            search=search,
        ) # noqa


    @classmethod
    async def create_report(
            cls,
            session: AsyncSession,
            report_data: SReportCreate

    ) -> int:

        # try:
        stmt_for_report_create = (
            insert(cls.model)
            .values(title=report_data.title, casting_id=report_data.casting_id)
            .returning(cls.model.id)
        )
        report_id = (await session.execute(stmt_for_report_create)).unique().scalar_one_or_none()
        return report_id
            # await cls.add_actors_for_report(session=session, data=SActorsDataForReport(
            #     report_id=report_id,
            #     actors_id=report_data.actors_id,
            # ))

        # except IntegrityError as err:
        #     if 'profiles_reports_profile_id_fkey' in str(err.orig):
        #         raise ProfileIdIsNotFound

    @classmethod
    async def add_actors_for_report(
            cls,
            session: AsyncSession,
            report_id: int,
            data: SActorsDataForReport

    ) -> None:
        try:
            data_for_insert = [
                {"profile_id": actor_id, "report_id": report_id}
                for actor_id in data.actors_id
            ]

            stmt = (
                pg_insert(ProfilesReports)
                .values(data_for_insert)
                .on_conflict_do_nothing(
                    index_elements=["profile_id", "report_id"]
                )
            )

            await session.execute(stmt, )

        except IntegrityError as err:
            if "uq_profile_id_report_id" in str(err.orig):
                raise ProfileReportUniqueConstraintExc
            if "profiles_reports_report_id_fkey" in str(err.orig):
                raise ReportIdIsNotFound
            if 'profiles_reports_profile_id_fkey' in str(err.orig):
                raise ProfileIdIsNotFound
            raise


    @classmethod
    async def delete_actors_from_report(
            cls,
            session: AsyncSession,
            report_id: int,
            data: SActorsDataForReport

    ) -> None:
        try:
            keys_to_delete = [(actor_id, report_id) for actor_id in data.actors_id]

            stmt = (
                delete(ProfilesReports)
                .where(
                    tuple_(ProfilesReports.profile_id, ProfilesReports.report_id).in_(keys_to_delete)
                )
            )

            await session.execute(stmt)

        except IntegrityError as err:
            if "profiles_reports_report_id_fkey" in str(err.orig):
                raise ReportIdIsNotFound
            if 'profiles_reports_profile_id_fkey' in str(err.orig):
                raise ProfileIdIsNotFound
            raise


    @classmethod
    async def full_delete_actors_from_report(
            cls,
            session: AsyncSession,
            report_id: int,

    ) -> None:
        try:
            stmt = (
                delete(ProfilesReports)
                .where(
                    ProfilesReports.report_id == report_id
                )
            )

            await session.execute(stmt)

        except IntegrityError as err:
            if "profiles_reports_report_id_fkey" in str(err.orig):
                raise ReportIdIsNotFound
            raise

    @classmethod
    async def edite_report(
            cls,
            session: AsyncSession,
            report_id: int,
            data: Union[SFullReportEdit, SReportEdit],

    ) -> None:
        try:
            stmt = update(Report).where(Report.id == report_id).values(**data.model_dump(exclude_none=True))
            await session.execute(stmt)
        except IntegrityError as err:
            if "profiles_reports_report_id_fkey" in str(err.orig):
                raise ReportIdIsNotFound
            raise

    @classmethod
    async def delete_report(
            cls,
            session: AsyncSession,
            report_id: int,

    ) -> None:
        try:
            stmt = delete(Report).where(Report.id == report_id)
            await session.execute(stmt)
        except IntegrityError as err:
            if "profiles_reports_report_id_fkey" in str(err.orig):
                raise ReportIdIsNotFound
            raise


    @classmethod
    async def set_null_value(
            cls,
            session: AsyncSession,
            report_id: int,
            coll: str,

    ) -> None:
        try:
            stmt = update(Report).where(Report.id == report_id).values(
                **{getattr(Report, coll): None}
            )
            await session.execute(stmt)
        except IntegrityError as err:
            if "profiles_reports_report_id_fkey" in str(err.orig):
                raise ReportIdIsNotFound
            raise


