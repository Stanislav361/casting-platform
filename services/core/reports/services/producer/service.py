from postgres.database import transaction
from reports.repositories.types.producer import ProducerReportRepository
from reports.schemas.producer import *
from shared.services.s3.services.media import S3MediaService
from sqlalchemy.ext.asyncio import AsyncSession
from reports.services.mixins import ActorListMixin
from typing import Optional, List
from reports.exceptions import *
from reports.repositories.types.base import BySelector
from profiles.repositories.types.admin import AdminActorRepository

class ProducerReportsService(
    ActorListMixin[ProducerReportRepository, SReportActorsFilters, SReportActorsSorts, SReportActorsList]
):
    S3 = S3MediaService(directory="reports")
    REPOSITORY = ProducerReportRepository
    ACTOR_FILTERS = SReportActorsFilters
    ACTOR_SORTS = SReportActorsSorts
    ACTORS_RESPONSE = SReportActorsList

    @classmethod
    @transaction
    async def get_report(
        cls,
        search: str,
        filters: SReportActorsFilters,
        sort_by: SReportActorsSorts,
        session: AsyncSession,
        public_id: int,
        page_size: int,
        page_number: int,
    ) -> SFullReportData:
        try:
            report = await ProducerReportRepository.get_report(
                session=session,
                report_id=public_id,
                by=BySelector.PUBLIC_ID
            )
            report_part = await ProducerReportRepository.get_report_extra(session=session, report_id=report.id)
            profiles_part = await cls.get_actors(
                session=session,
                report_id=report.id,
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
    async def add_favorite(
        cls,
        session: AsyncSession,
        public_id: int,
        actor_id: int,
    ) -> None:
        try:
            report = await ProducerReportRepository.get_report(
                session=session,
                report_id=public_id,
                by=BySelector.PUBLIC_ID
            )
            await ProducerReportRepository.delete_favorite(
                session=session,
                report_id=report.id,
                profile_id=actor_id,
                favorite_predicate=True
            )
        except ReportIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def delete_favorite(
        cls,
        session: AsyncSession,
        public_id: int,
        actor_id: int,
    ) -> None:
        try:
            report = await ProducerReportRepository.get_report(
                session=session,
                report_id=public_id,
                by=BySelector.PUBLIC_ID
            )
            await ProducerReportRepository.delete_favorite(
                session=session,
                report_id=report.id,
                profile_id=actor_id,
                favorite_predicate=False
            )
        except ReportIdIsNotFound as err:
            raise err.API_ERR

        except ProfileIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def full_delete_favorite(
        cls,
        session: AsyncSession,
        public_id: int,
    ) -> None:
        try:
            report = await ProducerReportRepository.get_report(
                session=session,
                report_id=public_id,
                by=BySelector.PUBLIC_ID
            )
            await ProducerReportRepository.full_delete_favorite(
                session=session,
                report_id=report.id,
            )
        except ReportIdIsNotFound as err:
            raise err.API_ERR

        except ProfileIdIsNotFound as err:
            raise err.API_ERR