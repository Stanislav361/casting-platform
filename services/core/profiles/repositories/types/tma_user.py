from profiles.enums import ImageType
from profiles.schemas.tma_user import SProfileUpdate
from profiles.models import Profile, ProfileImages, Response
from sqlalchemy.dialects.postgresql import insert as PSQLinsert  # noqa
from profiles.services.tma_user.exceptions import *
from sqlalchemy import select, insert, update, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
import urllib.parse
from shared.repository.base.repository import BaseRepository
from typing import Optional, Tuple
from cities.models import City
from sqlalchemy.orm import joinedload



class TmaProfileRepository(BaseRepository):
    model = Profile
    image_model = ProfileImages

    @classmethod
    async def get_profile(cls, session: AsyncSession, profile_id: int) -> type(Profile):
        stmt_get = (
            select(cls.model)
            .filter_by(id=profile_id)
            .outerjoin(City, City.full_name == cls.model.city_full)
            .options(joinedload(cls.model.city))
        )
        instance = (await session.execute(stmt_get)).unique().scalar_one_or_none()
        return instance

    @classmethod
    async def create_empty_profile_or_get(cls, session: AsyncSession, user_id: int) -> Profile:
        stmt_get = select(cls.model).filter_by(user_id=user_id)
        profile = (await session.execute(stmt_get)).unique().scalar_one_or_none()
        if profile:
            return profile
        stmt_insert = insert(cls.model).values(user_id=user_id).returning(cls.model)
        return (await session.execute(stmt_insert)).unique().scalar_one_or_none()

    @classmethod
    async def update_profile(cls, session: AsyncSession, profile_id: int, profile_data: SProfileUpdate) -> None:
        try:
            stmt = (
                update(cls.model)
                .where(cls.model.id == profile_id)
                .values(**profile_data.model_dump(exclude_unset=True, ))
            )
            await session.execute(stmt)

        except IntegrityError as err:
            if "profiles_city_fkey" in str(err.orig):
                raise CityNotFoundException
            if 'profiles_phone_number_key' in str(err.orig):
                raise PhoneNumberUniqueExc
            if 'profiles_email_key' in str(err.orig):
                raise EmailUniqueExc
            raise err
        except Exception as err:
            raise err

    @classmethod
    async def add_response(
            cls,
            session: AsyncSession,
            profile_id: int,
            casting_id: int,
            self_test_url: Optional[str]=None,
    ) -> None:
        try:
            stmt = insert(Response).values(
                profile_id=profile_id,
                casting_id=casting_id,
                self_test_url=self_test_url,
            )
            await session.execute(stmt)

        except IntegrityError as err:
            if "profile_responses_casting_id_fkey" in str(err.orig):
                raise CastingIsNotExisting
            if "uq_profile_id_casting_id" in str(err.orig):
                raise ProfileResponseUniqueExc
            raise

    # @classmethod
    # async def update_response(
    #         cls,
    #         session: AsyncSession,
    #         profile_id: int,
    #         casting_id: int,
    #         self_test_url: Optional[str]=None,
    # ) -> None:
    #     try:
    #         stmt = (
    #                 update(Response).
    #                 where((Response.profile_id == profile_id) & (Response.casting_id == casting_id))
    #                 .values(self_test_url=self_test_url,)
    #                 )
    #         await session.execute(stmt)
    #
    #     except IntegrityError as err:
    #         if "profile_responses_casting_id_fkey" in str(err.orig):
    #             raise CastingIsNotExisting
    #         if "uq_profile_id_casting_id" in str(err.orig):
    #             raise ProfileResponseUniqueExc
    #         raise

    @classmethod
    async def add_image(
            cls, session: AsyncSession,
            profile_id: int,
            photo_url: str,
            crop_photo_url: str,
            coordinates: dict,
            image_type: ImageType
    ):
        try:
            query_image = (
                insert(cls.image_model)
                .values(
                    parent_id=profile_id,
                    photo_url=photo_url,
                    crop_photo_url=crop_photo_url,
                    coordinates=coordinates,
                    image_type=image_type
                )
                .returning(cls.image_model)
            )
            query_model = ( # noqa
                update(cls.model)
                .where(cls.model.id == profile_id)
                .values(image_counter=cls.model.image_counter + 1)
                .returning(cls.model.image_counter)
            )
            await session.execute(query_model)
            await session.execute(query_image)

        except IntegrityError as err:
            if 'max_images_constraint' in str(err.orig):
                raise ImageMaxCounter(max_quantity=6).API_ERR
            raise

    @classmethod
    async def delete_image(cls, session: AsyncSession, image_id: int) -> Tuple[str, str]:
        try:
            delete_image_query = (
                delete(cls.image_model)
                .where(cls.image_model.id == image_id)
                .returning(
                    cls.image_model.parent_id,
                    cls.image_model.photo_url,
                    cls.image_model.crop_photo_url,
                )
            )
            delete_image_result = (await session.execute(delete_image_query)).fetchone()
            parent_id, file_link, crop_file_link = (
                delete_image_result if delete_image_result else (None, None)
            )
            decrement_image_query = ( # noqa
                update(cls.model)
                .where(cls.model.id == parent_id,)
                .values(image_counter=cls.model.image_counter - 1)
            )
            await session.execute(decrement_image_query)
            file_name = urllib.parse.unquote(file_link.split("/")[-1])
            crop_file_name = urllib.parse.unquote(crop_file_link.split("/")[-1])
            return file_name, crop_file_name

        except IntegrityError as e:
            if 'min_images_constraint' in str(e.orig):
                raise ImageMinCounter
            raise e
