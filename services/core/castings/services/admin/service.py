from castings.repositories.types.admin import AdminCastingRepository
from fastapi import UploadFile
from fastapi.responses import JSONResponse
from castings.schemas.admin import *
from postgres.database import transaction
from shared.services.s3.services.media import S3MediaService
from shared.validation.image.validations.casting import CastingImageValidate
from shared.validation.image.type.image import Image
from shared.validation.image.exceptions import *
from botocore.exceptions import ClientError, BotoCoreError
from castings.services.admin.exceptions import *
import asyncio
from castings.enums import CastingStatusEnum
from castings.services.admin.telegram.channel.service import CastingTelegramChannelService
from castings.services.admin.telegram.channel.templates.types.post import CloseCastingPostText, OpenCastingPostText
from pydantic import ValidationError
from typing import Optional


class AdminCastingService:

    S3 = S3MediaService(directory="castings")

    @classmethod
    @transaction
    async def get_casting(cls, session, casting_id) -> SCastingData:
        try:
            casting_obj = await AdminCastingRepository.get_casting(session=session, casting_id=casting_id)
            casting = SCastingData.model_validate(casting_obj)
            return casting
        except CastingIdIsNotFound as err:
            raise err.API_ERR

    @classmethod
    @transaction
    async def get_all_castings(
        cls,
        session,
        search: Optional[str],
        filters: SCastingFilters,
        sort_by: SCastingSorts,
        page_size: int,
        page_number: int,

    ) -> SCastingList:
        castings, query = await AdminCastingRepository.get_all_castings(
            session=session,
            search=search,
            filters=filters,
            sort_criteria=sort_by,
            page_size=page_size,
            page_number=page_number,
        )

        meta = await AdminCastingRepository.get_meta(
            session=session,
            query=query,
            page_number=page_number,
            page_size=page_size,
        )

        return SCastingList(meta=meta, response=castings)

    @classmethod
    @transaction
    async def get_responses(
        cls,
        session,
        casting_id: int,
        filters: SResponseFilters,
        sort_by: SResponseSorts,
        page_size: int,
        page_number: int,
        search: Optional[str] = None,
    ) -> SResponseList:

        responses, query = await AdminCastingRepository.get_responses(
            session=session,
            casting_id=casting_id,
            search=search,
            filters=filters,
            sort_criteria=sort_by,
            page_size=page_size,
            page_number=page_number
        )

        meta = await AdminCastingRepository.get_meta(
            session=session,
            query=query,
            page_number=page_number,
            page_size=page_size,
        )

        return SResponseList(meta=meta, response=responses)

    @classmethod
    @transaction
    async def create_casting(
            cls,
            session,
            title,
            description,
            image: Optional[UploadFile]=None
    ) -> JSONResponse:
        try:
            data = SCreateCasting(title=title, description=description)
            casting = await AdminCastingRepository.create_casting(session=session, data=data)
            if image:
                await cls.add_image(
                    session=session,
                    casting_id=casting.id,
                    image=image
                )
            return JSONResponse(status_code=status.HTTP_201_CREATED, content={'casting_id': casting.id})

        except ValidationError as e:
            raise HTTPException(status_code=422, detail=str(e))

    @classmethod
    @transaction
    async def edit_casting(
        cls,
        session,
        casting_id: int,
        image: Optional[UploadFile]=None,
        title: Optional[str] = None,
        description: Optional[str] = None,
    ) -> JSONResponse:
        casting = await cls.get_casting(session=session, casting_id=casting_id)
        try:
            if casting.status is CastingStatusEnum.closed:
                raise CastingCantWasBeEditedClose
            if casting.status is CastingStatusEnum.published:
                raise CastingCantWasBeEdited

            casting_data = SCastingEditData(title=title, description=description)
            await AdminCastingRepository.edit_casting(
                session=session,
                casting_id=casting_id,
                casting_data=casting_data
            )

            if image:
                await cls.add_image(
                    session=session,
                    casting_id=casting.id,
                    image=image
                )

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "Casting edited successfully",
                    "casting_id": casting_id,
                },
            )
        except CastingCantWasBeEdited as err:
            raise err.API_ERR
        except ValidationError as e:
            raise HTTPException(status_code=422, detail=str(e))
        except CastingCantWasBeEditedClose as err:
            raise err.API_ERR


    @classmethod
    @transaction
    async def add_image(cls, session, casting_id: int, image: UploadFile) -> JSONResponse:
        try:
            content, image_type = await CastingImageValidate().image_validate(image=image)
            valid_image = Image(s3=cls.S3, content=content, image_type=image_type)

            await AdminCastingRepository.add_image(
                session=session,
                casting_id=casting_id,
                photo_url=valid_image.photo_url,
            )
            await cls.S3.upload_file(file_name=f"{valid_image.image_name}", file=valid_image.content)
            return JSONResponse(
                status_code=status.HTTP_201_CREATED,
                content={
                    "image_name": valid_image.image_name,
                    "message": "Files uploaded successfully",
                },
            )

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
    async def publish_casting(cls, session, casting_id: int) -> JSONResponse:
        casting: SCastingData = await cls.get_casting(session=session, casting_id=casting_id)
        channel = CastingTelegramChannelService(casting=casting, post_text=OpenCastingPostText(casting=casting))
        try:
            message = await channel.publish_casting()
            publish_data = SCastingPostCreate(
                casting_id=casting.id,
                message_id=message.message_id,
                chat_id=message.chat.id,
                post_url= f"https://t.me/{message.chat.username}/{message.message_id}",
            )
            await AdminCastingRepository.publish_casting(session=session, publish_data=publish_data)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "Casting publish successfully",
                    "casting_id": casting.id,
                    'post_url': publish_data.post_url
                },
            )

        except CastingCantWasBeOpened as err:
            await channel.bot.post_rollback()
            raise err.API_ERR

        except Exception as err:
            await channel.bot.post_rollback()
            raise err

    @classmethod
    @transaction
    async def unpublish_casting(cls, session, casting_id: int):
        casting: SCastingData = await cls.get_casting(session=session, casting_id=casting_id)
        try:
            if casting.status is CastingStatusEnum.closed:
                raise CastingCantWasBeUnPublish
            channel = CastingTelegramChannelService(casting=casting, post_text=OpenCastingPostText(casting=casting))
            await channel.delete_casting()
            await AdminCastingRepository.unpublish_casting(session=session, casting_id=casting_id)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "Casting unpublish successfully",
                    "casting_id": casting.id,
                },
            )
        except CastingCantWasBeUnPublish as err:
            raise err.API_ERR
        except CastingCantWasBeDeleted:
            raise CastingCantWasBeDeleted().API_ERR

        except CastingWasBeDeleted:
            await AdminCastingRepository.unpublish_casting(session=session, casting_id=casting_id)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "Casting unpublish successfully",
                    "casting_id": casting.id,
                },
            )

    @classmethod
    @transaction
    async def close_casting(cls, session, casting_id) -> JSONResponse:
        casting = await cls.get_casting(session=session, casting_id=casting_id)
        channel = CastingTelegramChannelService(casting=casting, post_text=CloseCastingPostText(casting=casting))
        try:
            if casting.status is CastingStatusEnum.closed:
                raise CastingCantWasBeClosed
            if not casting.status is CastingStatusEnum.published:
                raise CastingCantWasBeClosedUnPublish
            await channel.close_casting()
            await AdminCastingRepository.close_casting(
                session=session,
                casting_id=casting_id,
            )
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "Casting close successfully",
                    "casting_id": casting.id,
                },
            )

        except CastingCantWasBeClosed as err:
            await channel.bot.post_rollback()
            raise err.API_ERR

        except CastingCantWasBeClosedUnPublish as err:
            await channel.bot.post_rollback()
            raise err.API_ERR

        except Exception as err:
            await channel.bot.post_rollback()
            raise err

    @classmethod
    @transaction
    async def delete_casting(cls, session, casting_id: int, ) -> JSONResponse:
        try:
            casting = await cls.get_casting(session=session, casting_id=casting_id)
            if casting.status is CastingStatusEnum.closed:
                raise ArchiveCastingCantWasBeDeleted
            if casting.status is CastingStatusEnum.published:
                raise PublishCastingCantWasBeDeleted
            tasks = [
                asyncio.create_task(
                    cls.delete_image(
                        session=session,
                        image_id=image_obj.id
                    )
                )
                for image_obj in casting.image
            ]
            await asyncio.gather(*tasks, return_exceptions=True)

            channel = CastingTelegramChannelService(
                casting=casting,
                post_text=OpenCastingPostText(casting=casting) # todo напиши нормлаьный сервис тупой ты, нахуйя передавать текст поста в удалении
            )
            await channel.delete_casting()
            await AdminCastingRepository.delete_casting(session=session, casting_id=casting_id)

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    'message': 'Casting deleted successfully',
                    'casting_id': casting_id,
                }
            )

        except CastingIdIsNotFound as err:
            raise err.API_ERR

        except ArchiveCastingCantWasBeDeleted as err:
            raise err.API_ERR

        except PublishCastingCantWasBeDeleted as err:
            raise err.API_ERR

        except (CastingWasBeDeleted, CastingCantWasBeDeleted):
            await AdminCastingRepository.delete_casting(session=session, casting_id=casting_id)

            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    'message': 'Casting deleted successfully',
                    'casting_id': casting_id,
                }
            )

    @classmethod
    @transaction
    async def delete_image(cls, session, image_id: int) -> JSONResponse:
        try:
            image_name, image_id, casting_id = await AdminCastingRepository.delete_image(session=session, image_id=image_id)
            casting = await cls.get_casting(session=session, casting_id=casting_id)
            if casting.status in (CastingStatusEnum.published, CastingStatusEnum.closed):
                raise CastingCantWasBeEdited
            await cls.S3.delete_file(image_name)
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "message": "image deleted successfully",
                    "image_id": image_id,
                    "image_name": image_name,
                },
            )

        except CastingCantWasBeEdited as err:
            raise err.API_ERR

        except ImageNotFound as err:
            raise err.API_ERR

        except ImageMinCounter as err:
            raise err.API_ERR

        except BotoCoreError as e:
            raise ImageDeleteFailed().API_ERR

        except ClientError as e:
            raise ImageDeleteFailed().API_ERR



# if __name__ == "__main__":
#     from shared.services.telegram.channel.service import TelegramChannelService
#
#     channel = TelegramChannelService(
#         post_text="""
#         **Москва**🤨
# [link text](https://example.com)
# ~~Для съемки нового~~ фильма-сказки «Колобок» от создателей *«Последний богатырь. Наследие»*, требуется: Мальчик 5-8 лет, <u>АКТЕР</u> Трогательный, милый, светлые волосы, выразительные глаза. Дисциплинированный, внимательный, способный четко выполнять поставленные задачи.
#
# Опыт съемки обязательный! В приоритете обучающийся в актерских школах/студиях. Анкеты без видео визитки не смотрим. Подходящих кандидатов будем в ближайшее время приглашать на очные пробы. Значимая роль в проекте Докастинг 7.07. Финальный день проб Только те, кто готовы приехать на очный кастинг с 14:30 до 16:00. Съемочный период: с 15.08. по 30.09. Будет порядка 4-5 смен. Не иметь занятости и ограничений в указанный период. Вознаграждение: актерская ставка, обсуждаем индивидуально. В заявке необходимо прислать ФИО, возраст, свежие фото (портрет, полный рост), видео визитку, рост, размер одежды/обуви и номер тел/вотсап. Анкеты отправлять на почту
#         """,
#     )
#     async def main():
#         await channel.send_post_without_image()
#
#     import asyncio
#     asyncio.run(main())