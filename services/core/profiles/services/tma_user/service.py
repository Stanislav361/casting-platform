import asyncio
from fastapi import UploadFile
from postgres.database import transaction
from shared.services.s3.services.media import S3MediaService
from profiles.schemas.tma_user import SProfileUpdate, SProfileData, SProfileResponsePost
from profiles.services.tma_user.exceptions import *
from botocore.exceptions import ClientError, BotoCoreError
from shared.validation.image.exceptions import *
from shared.validation.image.validations.profile import ProfileImageValidate
from shared.validation.image.type.image import Image
from typing import Union
from profiles.services.tma_user.utils import *
from errors import NotFound
from profiles.enums import ImageType
from pydantic import ValidationError
from shared.validation.pydantic_utils.adapters.errors import serialize_validation_errors


class TmaProfileService:

    S3 = S3MediaService(directory="profiles")

    @classmethod
    @transaction
    async def get_profile(cls, session, user_token: JWT) -> SProfileData:
        profile = await TmaProfileRepository.get_profile(session=session, profile_id=int(user_token.profile_id))
        return SProfileData.model_validate(profile)


    @classmethod
    @transaction
    async def create_empty_profile_or_get(cls, session, user_id: int) -> int:
        profile = await TmaProfileRepository.create_empty_profile_or_get(session=session, user_id=user_id)
        return profile.id

    @classmethod
    @transaction
    async def edit_profile(cls, session, user_token: JWT, profile_data: SProfileUpdate) -> int:
        try:
            await TmaProfileRepository.update_profile(
                session=session,
                profile_id=int(user_token.profile_id),
                profile_data=profile_data,
            )
            return status.HTTP_201_CREATED

        except CityNotFoundException as err:
            raise err.API_ERR

        except PhoneNumberUniqueExc as err:
            raise err.API_ERR

        except EmailUniqueExc as err:
            raise err.API_ERR

        except Exception as e:
            raise e

    @classmethod
    @transaction
    async def add_response(
            cls,
            session,
            user_token: JWT,
            response: SProfileResponsePost,
    ) -> int:
        try:
            await check_profile_fields(session=session, token=user_token)
            await check_casting_for_response(session=session, casting_id=response.casting_id)
            await TmaProfileRepository.add_response(
                session=session,
                profile_id=int(user_token.profile_id),
                casting_id=response.casting_id,
                # self_test_url=str(response.video_intro) if response.video_intro else None,
            )
            return status.HTTP_201_CREATED

        except FieldsEmptyExc as err:
            raise err.API_ERR

        except ImageConditionExc as err:
            raise err.API_ERR

        except ProfileResponseUniqueExc as err:
            raise err.API_ERR

        except CastingIsNotExisting as err:
            raise err.API_ERR

        except CastingIsClosed as err:
            raise err.API_ERR

    # @classmethod
    # @transaction
    # async def update_response(
    #     cls,
    #     session,
    #     user_token: JWT,
    #     response: SProfileResponsePost,
    # ) -> int:
    #     try: # noqa
    #         await check_profile_fields(session=session, token=user_token)
    #         await check_casting_for_response(session=session, casting_id=response.casting_id)
    #         await TmaProfileRepository.update_response(
    #             session=session,
    #             profile_id=int(user_token.profile_id),
    #             casting_id=response.casting_id,
    #             # self_test_url=str(response.video_intro) if response.video_intro else None,
    #         )
    #         return status.HTTP_200_OK
    #
    #     except FieldsEmptyExc as err:
    #         raise err.API_ERR
    #
    #     except ImageConditionExc as err:
    #         raise err.API_ERR
    #
    #     except ProfileResponseUniqueExc as err:
    #         raise err.API_ERR
    #
    #     except CastingIsNotExisting as err:
    #         raise err.API_ERR
    #
    #     except CastingIsClosed as err:
    #         raise err.API_ERR


    @classmethod
    @transaction
    async def add_image(
        cls,
        session,
        user_token: JWT,
        image: UploadFile,
        image_type: ImageType,
        x1: Union[int, float],
        y1: Union[int, float],
        x2: Union[int, float],
        y2: Union[int, float],
    ) -> int:
        try:
            coordinates: SImageCoordinate = get_coordinate_model(x1=x1, y1=y1, x2=x2, y2=y2)

            content, content_2_3, image_format_type = await (
                ProfileImageValidate(_2_3_coordinate=coordinates)
                .image_validate(image=image)
            )

            valid_image = Image(s3=cls.S3, content=content, crop_content=content_2_3, image_type=image_format_type)

            await TmaProfileRepository.add_image(
                session=session,
                profile_id=int(user_token.profile_id),
                image_type=image_type,
                photo_url=valid_image.photo_url,
                crop_photo_url=valid_image.crop_photo_url,
                coordinates=coordinates.model_dump(),
            )

            s3_tasks = [
                cls.S3.upload_file(file_name=f"{valid_image.image_name}", file=valid_image.content),
                # cls.S3.upload_file(file_name=f"{valid_image.crop_image_name}", file=valid_image.crop_content),
            ]

            await asyncio.gather(*s3_tasks)

            return status.HTTP_201_CREATED


        except ValidationError as err:
            raise ImageCoordinatesExc(err_details=serialize_validation_errors(err.errors())).API_ERR

        except ImageMaxCounter as err:
            raise err.API_ERR

        except ImageSizeTooBig as err:
            raise err.API_ERR

        except ImageContentIsEmpty as err:
            raise err.API_ERR

        except ImageCorrupted as err:
            raise err.API_ERR

        except ContentImageFormatIsNotValid as err:
            raise err.API_ERR

        except HeaderImageFormatIsNotValid as err:
            raise err.API_ERR

        except InvalidAspectRatio as err:
            raise err.API_ERR

        except BotoCoreError:
            await cls.S3.rollback_uploaded_s3_files([image.filename, ])
            raise ImageUploadFailed().API_ERR

        except Exception as e:
            await cls.S3.rollback_uploaded_s3_files([image.filename, ])
            raise e

    @classmethod
    @transaction
    async def delete_image(cls, session, user_token: JWT, image_id: int) -> int:
        try:
            await check_image_permissions(
                session=session,
                child_id=image_id,
                token=user_token,
            )
            image_name, crop_image_name = await TmaProfileRepository.delete_image(session=session, image_id=image_id)
            s3_tasks = [
                cls.S3.delete_file(image_name),
                cls.S3.delete_file(crop_image_name),
            ]
            await asyncio.gather(*s3_tasks)

            return status.HTTP_204_NO_CONTENT

        except NotFound:
            raise ImageNotFound().API_ERR

        except ImageMinCounter as err:
            raise err.API_ERR

        except BotoCoreError:
            raise ImageDeleteFailed().API_ERR

        except ClientError:
            raise ImageDeleteFailed().API_ERR
