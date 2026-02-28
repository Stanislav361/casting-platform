from sqlalchemy import select, insert, update, delete
from sqlalchemy.orm import joinedload, selectinload, with_loader_criteria
from sqlalchemy.sql.selectable import Select
from castings.models import Casting, CastingImage, TelegramPost
from castings.schemas.admin import *
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List, Tuple
from sqlalchemy.exc import IntegrityError
from castings.services.admin.exceptions import *
from postgres.database import transaction
import urllib.parse
from profiles.models import Response, Profile
from shared.repository.base.repository import BaseRepository
from castings.repositories.utils.admin import CastingResponsesListQueryUtil, CastingListQueryUtil
from castings.enums import CastingStatusEnum
from cities.models import City

class AdminCastingRepository(BaseRepository):
    model = Casting
    image_model = CastingImage
    post_model = TelegramPost
    casting_lst_util = CastingListQueryUtil()
    response_lst_util = CastingResponsesListQueryUtil()


    @classmethod
    async def get_all_castings(
        cls,
        session: AsyncSession,
        filters: SCastingFilters,
        sort_criteria: SCastingSorts,
        page_size: int,
        page_number: int,
        search: Optional[str] = None,
    ) -> Tuple[List[Optional[Casting]], Select]:

        start_stmt = (
            select(cls.model)
            .outerjoin(TelegramPost, TelegramPost.casting_id == Casting.id)
            .options(joinedload(cls.model.responses))
        )
        execute_stmt, stmt_for_meta = cls.casting_lst_util.generate_list_query(
            search=search,
            start_query=start_stmt,
            filters=filters,
            sort_criteria=sort_criteria,
            page_size=page_size,
            page_number=page_number
        )

        return (await session.execute(execute_stmt)).unique().scalars().all(), stmt_for_meta  # noqa

    @classmethod
    async def get_casting(cls, session: AsyncSession, casting_id) -> Casting:
        query = (
                 select(cls.model)
                 .filter_by(id=casting_id)
                 .options(joinedload(cls.model.responses))
                 )
        casting = (await session.execute(query)).unique().scalar_one_or_none()
        if not casting:
            raise CastingIdIsNotFound
        return casting

    @classmethod
    async def get_responses(
        cls,
        session: AsyncSession,
        casting_id: int,
        filters: SResponseFilters,
        sort_criteria: SResponseSorts,
        page_size: int,
        page_number: int,
        search: Optional[str] = None,

    ) -> Tuple[List[Optional[Response]], Select]:

        start_stmt = (
                      select(Profile)
                      .join(Response, Response.profile_id == Profile.id)
                      .filter(Response.casting_id == casting_id)
                      .outerjoin(City, City.full_name == Profile.city_full)
                      .options(
                          joinedload(Profile.user),
                          selectinload(Profile.responses),
                          with_loader_criteria(Response, Response.casting_id == casting_id),
                          joinedload(Profile.city),
                      )
                      )
        execute_stmt, stmt_for_meta = cls.response_lst_util.generate_list_query(
            search=search,
            start_query=start_stmt,
            filters=filters,
            sort_criteria=sort_criteria,
            page_size=page_size,
            page_number=page_number,
        )
        return (await session.execute(execute_stmt)).unique().scalars().all(), stmt_for_meta # noqa

    @classmethod
    async def get_image(cls, session: AsyncSession, image_id) -> CastingImage:
        query = select(cls.image_model).filter_by(id=image_id)
        image = (await session.execute(query)).unique().scalar_one_or_none()
        if not image:
            raise ImageIdIsNotFound
        return image

    @classmethod
    async def create_casting(cls, session: AsyncSession, data: SCreateCasting) -> Casting:
        stmt = (
            insert(cls.model)
            .values(**data.model_dump())
            .returning(cls.model)
        )
        return (await session.execute(stmt)).unique().scalar_one_or_none()

    @classmethod
    async def add_image(cls, session: AsyncSession, casting_id: int, photo_url: str) -> ...:
        try:
            query_image = (
                insert(cls.image_model)
                .values(parent_id=casting_id, photo_url=photo_url)
                .returning(cls.image_model)
            )
            query_model = (
                update(cls.model)
                .where(cls.model.id == casting_id)
                .values(image_counter=cls.model.image_counter + 1)
                .returning(cls.model.image_counter)
            )
            (await session.execute(query_model)).scalar_one()
            await session.execute(query_image)
        except IntegrityError as err:
            if 'max_images_constraint' in str(err.orig):
                raise ImageMaxCounter(max_quantity=1).API_ERR
            raise

    @classmethod
    async def edit_casting(cls, session: AsyncSession, casting_id: int, casting_data: SCastingEditData):
        query = (
            update(cls.model)
            .where(cls.model.id == casting_id)
            .values(**casting_data.model_dump())
            .returning(cls.model)
        )
        await session.execute(query)

    @classmethod
    async def publish_casting(cls, session: AsyncSession, publish_data: SCastingPostCreate) -> None:
        try:
            casting_query = (
                update(cls.model)
                .where(cls.model.id == publish_data.casting_id)
                .values(status=CastingStatusEnum.published)
            )
            post_query = (
                insert(cls.post_model)
                .values(**publish_data.model_dump())
            )
            await session.execute(casting_query)
            await session.execute(post_query)

        except IntegrityError as err:
            if "casting_posts_casting_id_key" in str(err.orig):
                raise CastingCantWasBeOpened

    @classmethod
    @transaction
    async def unpublish_casting(cls, session: AsyncSession, casting_id: id) -> None:
        try:
            casting_query = (
                update(cls.model)
                .where(cls.model.id == casting_id)
                .values(status=CastingStatusEnum.unpublished)
            )
            post_query = (
                delete(cls.post_model)
                .where(cls.post_model.casting_id == casting_id)
            )
            await session.execute(casting_query)
            await session.execute(post_query)

        except IntegrityError as err:
            if "casting_posts_casting_id_key" in str(err.orig):
                raise CastingCantWasBeOpened

    @classmethod
    async def close_casting(cls, session: AsyncSession, casting_id: int) -> None:
        casting_query = (
            update(cls.model)
            .where(cls.model.id == casting_id)
            .values(
                status=CastingStatusEnum.closed,
            )
        )
        post_query = (
            update(cls.post_model)
            .where(cls.post_model.casting_id == casting_id)
            .values(closed_at=datetime.now(timezone.utc),)
        )
        await session.execute(casting_query)
        await session.execute(post_query)

    @classmethod
    async def delete_casting(cls, session: AsyncSession, casting_id: int) -> ...:
        query = delete(cls.model).where(cls.model.id == casting_id)
        await session.execute(query)

    @classmethod
    async def delete_image(cls, session: AsyncSession, image_id: int) -> Tuple[str, int, int]:
        try:
            delete_image_query = (
                delete(cls.image_model)
                .where(cls.image_model.id == image_id)
                .returning(
                    cls.image_model.parent_id,
                    cls.image_model.id,
                    cls.image_model.photo_url,
                )
            )
            delete_image_result = (await session.execute(delete_image_query)).fetchone()
            parent_id, image_id, file_link = (
                delete_image_result if delete_image_result else (None, None, None)
            )
            if not image_id or not file_link:
                raise ImageNotFound

            decrement_image_query = (
                update(cls.model)
                .where(cls.model.id == parent_id,)  # noqa
                .values(image_counter=cls.model.image_counter - 1)
            )
            await session.execute(decrement_image_query)
            file_name = urllib.parse.unquote(file_link.split("/")[-1])
            return file_name, image_id, parent_id

        except IntegrityError as e:
            if 'min_images_constraint' in str(e.orig):
                raise ImageMinCounter
            raise
