from shared.repository.base.repository import BaseRepository
from typing import TypeVar
from profiles.models import Profile
from reports.repositories.utils.base import BaseReportActorListQueryUtil
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, distinct, cast, literal, ColumnElement, Subquery
from typing import Tuple
from reports.schemas.admin import *
from reports.models import Report
from sqlalchemy.sql.selectable import Select
from reports.exceptions import *
from sqlalchemy.engine.row import RowMapping
from reports.repositories.utils.admin import ReportAliased as Ra
from sqlalchemy import case, select, and_
from enum import StrEnum
from reports.schemas.base import SBaseReportActorsSorts, SBaseReportActorsFilters
from shared.repository.base.utils import ExtraListQuery
from sqlalchemy.dialects import postgresql


AF = TypeVar("AF", bound=SBaseReportActorsFilters)
AS = TypeVar("AS", bound=SBaseReportActorsSorts)

reports = Ra.reports
profile_reports = Ra.profile_reports
profiles = Ra.profiles
profile_images = Ra.profile_images
responses = Ra.responses
casting = Ra.casting
casting_image = Ra.casting_images
user = Ra.user
city = Ra.city

class BySelector(StrEnum):
    ID = 'id'
    PUBLIC_ID = 'public_id'

class BaseReportsRepository(BaseRepository):

    model = Report
    report_actors_lst_util: Optional[BaseReportActorListQueryUtil] = None

    @classmethod
    async def get_report(
            cls,
            session: AsyncSession,
            report_id: int,
            by: BySelector = BySelector.ID,
    ) -> Optional[Report]:
        stmt = (
            select(cls.model).
            filter_by(** {'id': report_id} if by is BySelector.ID else {'public_id': report_id})
        )
        result = (await session.execute(stmt)).unique().scalars().one_or_none()
        if not result:
            raise ReportIdIsNotFound
        return result


    @classmethod
    async def get_report_extra(
            cls,
            session: AsyncSession,
            report_id: int
    ) -> RowMapping:

        stmt = (
            select(
                reports.id.label("id"),
                reports.public_id.label("public_id"),
                reports.title.label("title"),
                reports.created_at.label("created_at"),
                reports.updated_at.label("updated_at"),
                casting.id.label("casting_id"),
                casting.title.label("casting_title"),
                func.count(distinct(responses.profile_id)).label("actors_via_casting"),
                (func.count(distinct(profile_reports.profile_id)) - func.count(distinct(responses.profile_id))).label("actors_without_casting"),
            )
            .outerjoin(profile_reports, profile_reports.report_id == reports.id) # noqa
            .outerjoin(profiles, profiles.id == profile_reports.profile_id)
            .outerjoin(casting, casting.id == reports.casting_id)
            .outerjoin(
                responses,
                and_(
                    responses.profile_id == profiles.id,
                    responses.casting_id == reports.casting_id,
                )
            )
            .where(reports.id == report_id)
            .group_by(reports.id, reports.public_id, reports.title, reports.created_at, casting.id, casting.title)
        )

        result = (await session.execute(stmt)).mappings().one_or_none()
        if not result:
            raise ReportIdIsNotFound
        return  result


    @classmethod
    async def get_actors(
            cls,
            session: AsyncSession,
            report_id: int,
            in_report: bool,
            page_size: Optional[int] = None,
            page_number: Optional[int] = None,
            filters: Optional[AF] = None,
            sort_criteria: Optional[AS] = None,
            search: Optional[str] = None,
    ) -> Select:

        # ---- 1. Подзапрос для изображений ----
        images_subq = (
            select(
                profile_images.parent_id.label("profile_id"),
                func.array_agg(
                    func.distinct(
                        func.jsonb_build_object(
                            "id", profile_images.id,
                            "image_type", profile_images.image_type,
                            "photo_url", profile_images.photo_url,
                            "crop_photo_url", profile_images.crop_photo_url,
                            "created_at", profile_images.created_at
                        )
                    )
                ).label("images")
            )
            .group_by(profile_images.parent_id)
        ).subquery()

        # ---- 2. Подзапрос для городов ----
        # DISTINCT важен, чтобы не было дублей по city_full
        city_subq = (
            select(
                city.full_name.label("full_name"),
                func.jsonb_build_object(
                    "name", city.name,
                    "region", city.region,
                    "full_name", city.full_name,
                ).label("city")
            )
            .distinct(city.full_name)
        ).subquery()

        # ---- 3. Подзапрос для профилей в репортах ----
        # Сводим к одной записи на профиль
        profile_reports_subq = (
            select(
                profile_reports.profile_id,
                func.bool_or(profile_reports.favorite).label("favorite")
            )
            .where(profile_reports.report_id == report_id) # noqa
            .group_by(profile_reports.profile_id)
        ).subquery()

        # ---- 4. Подзапрос для откликов (responses) ----
        # Проверяем, был ли отклик на кастинг и получаем отклик
        responses_subq = (
            select(
                responses.profile_id,
                func.coalesce(
                    func.array_agg(
                        func.jsonb_build_object(
                            "id", responses.id,
                            "self_test_url", responses.self_test_url,
                            "profile_id", responses.profile_id,
                            "casting_id", responses.casting_id,
                            "created_at", responses.created_at
                        )
                    ).filter(responses.casting_id == reports.casting_id),
                ).label("responses"),
                func.max(responses.created_at)
                .filter(responses.casting_id == reports.casting_id)
                .label("last_response_at"),
                func.bool_or(responses.casting_id == reports.casting_id).label("via_casting"),
            )
            .join(reports, reports.id == report_id)
            .group_by(responses.profile_id)
        ).subquery('responses')

        # ---- 5. Основной запрос ----
        start_stmt = (
            select(
                profiles.id,
                profile_reports_subq.c.favorite,
                profiles.phone_number,
                profiles.email,
                profiles.first_name,
                profiles.last_name,
                profiles.date_of_birth,
                profiles.gender,
                profiles.qualification,
                profiles.experience,
                profiles.look_type,
                profiles.hair_color,
                profiles.hair_length,
                profiles.height,
                profiles.clothing_size,
                profiles.shoe_size,
                profiles.bust_volume,
                profiles.waist_volume,
                profiles.hip_volume,
                profiles.video_intro,
                profiles.city_full,
                images_subq.c.images,
                city_subq.c.city,
                user.telegram_username,
                responses_subq.c.responses,  # <-- тут все отклики профиля
                func.coalesce(responses_subq.c.via_casting, False).label("via_casting"),
                responses_subq.c.last_response_at,
            )
            .join(user, user.id == profiles.user_id) # noqa
            .outerjoin(images_subq, images_subq.c.profile_id == profiles.id)
            .outerjoin(city_subq, city_subq.c.full_name == profiles.city_full)
            .outerjoin(profile_reports_subq, profile_reports_subq.c.profile_id == profiles.id)
            .outerjoin(responses_subq, responses_subq.c.profile_id == profiles.id)
            .group_by(
                profiles.id,
                profile_reports_subq.c.favorite,
                profiles.phone_number,
                profiles.email,
                profiles.first_name,
                profiles.last_name,
                profiles.date_of_birth,
                profiles.gender,
                profiles.qualification,
                profiles.experience,
                profiles.look_type,
                profiles.hair_color,
                profiles.hair_length,
                profiles.height,
                profiles.clothing_size,
                profiles.shoe_size,
                profiles.bust_volume,
                profiles.waist_volume,
                profiles.hip_volume,
                profiles.video_intro,
                profiles.city_full,
                images_subq.c.images,
                city_subq.c.city,
                user.telegram_username,
                responses_subq.c.via_casting,
                responses_subq.c.last_response_at,
                responses_subq.c.responses,
            )
        )

        if in_report:
            start_stmt = start_stmt.join(
                profile_reports,
                profile_reports.profile_id == profiles.id
            ).where(profile_reports.report_id == report_id)

        return start_stmt, responses_subq