from aiogram.types import Message
from typing import List, Optional, Union
from castings.schemas.admin import SCastingData, SCastingImageData, SCastingEditData
from config import settings
from aiogram.types import InputMediaPhoto, Message
from shared.services.telegram.channel.service import TelegramChannelService
from castings.services.admin.telegram.channel.templates.types.post import BaseCastingPostText
from castings.services.admin.telegram.channel.templates.types.buttons import CastingPostButton
from castings.services.admin.exceptions import (
    CastingCantWasBeClosed,
    CastingWasBeDeleted,
    CastingCantWasBeDraft,
    CastingCantWasBeDeleted,
)
from aiogram.exceptions import TelegramBadRequest


class CastingTelegramChannelService:

    def __init__(
            self,
            casting: Union[SCastingData, SCastingEditData],
            post_text: BaseCastingPostText,

    ):
        self.casting = casting
        self.bot = TelegramChannelService(post_text=post_text, button=CastingPostButton(casting=casting))


    async def publish_casting(self, ) -> Message:
        try:
            if self.casting.image:
                return await self.bot.send_post_with_image(
                    image_url=self.casting.image[0].photo_url # noqa
                )
            return await self.bot.send_post_without_image()

        except Exception as err:
            raise err

    async def close_casting(self, ):
        try:
            await self.bot.reply_post(
                message_id=self.casting.post.message_id,
            )

        except Exception as e:
            raise e

    async def delete_casting(
        self,
    ):
        try:
            post = self.casting.post
            if not post:
                raise CastingCantWasBeDeleted
            await self.bot.delete_post(
                message_id=self.casting.post.message_id,
            )
        except TelegramBadRequest as err:
            if "message can't be deleted" in str(err):
                raise CastingWasBeDeleted
            raise err
        except Exception as er:
            raise er
