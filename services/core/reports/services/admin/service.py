from postgres.database import transaction
from reports.repositories.types.admin import AdminReportsRepository
from reports.services.mixins import ActorListMixin
from reports.schemas.admin import *
from reports.schemas.report_generate import *
from shared.services.s3.services.media import S3MediaService
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from fastapi.responses import JSONResponse
from reports.models import Report
from reports.services.admin.exceptions import *
from reports.exceptions import *


class AdminReportsService(
    ActorListMixin[AdminReportsRepository, SReportActorsFilters, SReportActorsSorts, SReportActorsList]
):
    S3 = S3MediaService(directory="reports")
    REPOSITORY = AdminReportsRepository
    ACTOR_FILTERS = SReportActorsFilters
    ACTOR_SORTS = SReportActorsSorts
    ACTORS_RESPONSE = SReportActorsList

    @classmethod
    @transaction
    async def get_report_extra(
        cls,
        session: AsyncSession,
        report_id: int,
    ) -> SWidgetReportData:
        try:
            return SWidgetReportData.model_validate(
                await cls.REPOSITORY.get_report_extra(session=session, report_id=report_id)
            )
        except ReportIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def get_report(
        cls,
        search: str,
        filters: SReportActorsFilters,
        sort_by: SReportActorsSorts,
        session: AsyncSession,
        report_id: int,
        page_size: int,
        page_number: int,
    ) -> SFullReportData:
        try:
            report_part = await cls.REPOSITORY.get_report_extra(session=session, report_id=report_id)
            profiles_part = await cls.get_actors(
                session=session,
                report_id=report_id,
                in_report=True,
                search=search,
                filters=filters,
                sort_by=sort_by,
                page_size=page_size,
                page_number=page_number,

            )
            pre_full_data = SFullReportData.model_validate(report_part)
            pre_full_data.actors = profiles_part
            full_data = pre_full_data
            return full_data

        except ReportIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def get_all_reports(
        cls,
        session: AsyncSession,
        search: Optional[str],
        filters: SReportFilters,
        sort_by: SReportSorts,
        page_size: int,
        page_number: int,

    ) -> SReportList:
        
        reports, query = await cls.REPOSITORY.get_all_reports(
            session=session,
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

        return SReportList(meta=meta, response=reports) # noqa

    @classmethod
    @transaction
    async def get_actors_id(
            cls,
            session: AsyncSession,
            report_id: int,
            in_report: bool,
            filters: SReportActorsFilters,
            sort_by: SReportActorsSorts,
            search: Optional[str] = None,
    ) -> SReportActorsListIds:

        actors, meta = await cls.REPOSITORY.get_actors_id(
            session=session,
            report_id=report_id,
            in_report=in_report,
            search=search,
            filters=filters,
            sort_criteria=sort_by,
        )
        return SReportActorsListIds(response=actors, meta=None)

    # @classmethod
    # @transaction
    # async def generate_report(
    #         cls,
    #         session: AsyncSession,
    #         report_id: int,
    # ):
    #     try:
    #         report = await AdminReportsRepository.get_report(session=session, report_id=report_id, )
    #         cls._delete_report_sheet_if_exists(session=session, report=report)
    #         actors, _ = await AdminReportsRepository.get_actors(
    #             session=session,
    #             report_id=report_id,
    #             in_report=True,
    #             page_size=1000,
    #             page_number=1,
    #         )
    #         report_data = SReportGenerate(rows=actors).get_sheet_data()
    #         report_link, sheet_id = GenerateReportService.generate_report(
    #             report_name=f'{report.title} - {datetime.now(timezone.utc).strftime("%d-%m-%Y")}',
    #             report_data=report_data
    #         )
    #         try:
    #             await AdminReportsRepository.edite_report(
    #                 session=session, report_id=report_id, data=SFullReportEdit(link=str(report_link), )
    #             )
    #         except Exception as err:
    #             GenerateReportService.delete_report(sheet_id)
    #             raise err
    #         return report_link
    #     except ReportIdIsNotFound as err:
    #         raise err.API_ERR

    @classmethod
    @transaction
    async def create_report(
            cls,
            session: AsyncSession,
            report_data: SReportCreate
    ) -> JSONResponse:
        # try:
        report_id = await cls.REPOSITORY.create_report(
            session=session,
            report_data=report_data,
        )
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={"message": "Отчет создан", "report_id": report_id}
        )
        # except ProfileIdIsNotFound as err:
        #     raise err.API_ERR


    @classmethod
    @transaction
    async def add_actors_for_report(
            cls,
            session: AsyncSession,
            report_id: int,
            data: SActorsDataForReport
    ) -> status:
        try:
            report = await cls.REPOSITORY.get_report(session=session, report_id=report_id, )
            # cls._delete_report_sheet_if_exists(session=session, report=report)
            await cls.REPOSITORY.add_actors_for_report(
                session=session,
                report_id=report_id,
                data=data,
            )
            return status.HTTP_201_CREATED
        except ProfileReportUniqueConstraintExc as err:
            raise err.API_ERR
        except ReportIdIsNotFound as err:
            raise err.API_ERR
        except ProfileIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def edit_report(
            cls,
            session: AsyncSession,
            report_id: int,
            data: SReportEdit
    ) -> status:
        try:
            await cls.REPOSITORY.edite_report(
                session=session,
                report_id=report_id,
                data=data
            )
            return status.HTTP_204_NO_CONTENT
        except ReportIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def delete_actors_from_report(
            cls,
            session: AsyncSession,
            report_id: int,
            data: SActorsDataForReport
    ) -> status:
        try:
            report = await cls.REPOSITORY.get_report(session=session, report_id=report_id, )
            # cls._delete_report_sheet_if_exists(session=session, report=report)
            await cls.REPOSITORY.delete_actors_from_report(
                session=session,
                report_id=report_id,
                data=data,
            )
            return status.HTTP_204_NO_CONTENT
        except ReportIdIsNotFound as err:
            raise err.API_ERR
        except ProfileIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def full_delete_actors_from_report(
            cls,
            session: AsyncSession,
            report_id: int,
    ) -> status:
        try:
            # report = await AdminReportsRepository.get_report(session=session, report_id=report_id, )
            # cls._delete_report_sheet_if_exists(session=session, report=report)
            await cls.REPOSITORY.full_delete_actors_from_report(
                session=session,
                report_id=report_id,
            )
            return status.HTTP_204_NO_CONTENT
        except ReportIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def delete_report(
            cls,
            session: AsyncSession,
            report_id: int,
    ) -> status:
        try:
            # report = await AdminReportsRepository.get_report(session=session, report_id=report_id, )
            # cls._delete_report_sheet_if_exists(session=session, report=report)
            await cls.REPOSITORY.delete_report(
                session=session,
                report_id=report_id,
            )
            return status.HTTP_204_NO_CONTENT
        except ReportIdIsNotFound as err:
            raise err.API_ERR

    # @classmethod
    # @transaction
    # async def _delete_report_sheet_if_exists(
    #         cls,
    #         session: AsyncSession,
    #         report: Report,
    # ) -> status:
    #     if report.link:
    #         GenerateReportService.delete_report(sheet_id=report.link.split('/')[-1])
    #         await AdminReportsRepository.set_null_value(
    #             session=session,
    #             report_id=report.id,
    #             coll='link'
    #         )