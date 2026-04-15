from typing import Optional
from castings.services.admin.telegram.channel.templates.types.buttons import CastingPostButton
from shared.services.telegram.bot.client import bot
from config import settings
from aiogram.types import Message, InlineKeyboardMarkup
from shared.services.telegram.channel.templates.types.post import ChannelPostText
from shared.services.telegram.channel.templates.types.button import ChannelPostButton


class TelegramChannelService:

    def __init__(
            self,
            post_text: Optional[ChannelPostText] = None,
            button: Optional[ChannelPostButton] = None
    ):
        self._post_text: str = post_text.get_message() if post_text else ""
        self._keyboard: InlineKeyboardMarkup = button.get_button() if button else None
        self.message: Optional[Message] = None
        self.parse_mode: str = "HTML"

    @property
    def post_text(self) -> str:
        return self._post_text

    @property
    def keyboard(self) -> InlineKeyboardMarkup:
        return self._keyboard

    async def send_post_without_image(self, ) -> Message:
        try:
            async with bot as session:
                message = await session.send_message(
                    chat_id=settings.TG_CHANEL_NAME,
                    text=self.post_text,
                    parse_mode=self.parse_mode,
                    reply_markup=self.keyboard
                )
                self.message = message
                return message

        except Exception as e:
            raise e

    async def send_post_with_image(self, image_url: str) -> Message:
        try:
            async with bot as session:
                message = await session.send_photo(
                    chat_id=settings.TG_CHANEL_NAME,
                    photo=image_url,
                    caption=self.post_text,
                    parse_mode=self.parse_mode,
                    reply_markup=self.keyboard
                )
                self.message = message # data for rollback
                return message

        except Exception as e:
            raise e

    async def reply_post(self, message_id: int):
        try:
            async with bot as session:
                message = await session.send_message(
                    chat_id=settings.TG_CHANEL_NAME,
                    text=self.post_text,
                    parse_mode=self.parse_mode,
                    reply_to_message_id=message_id,
                )
                self.message = message  # data for rollback

        except Exception as e:
            raise e

    @staticmethod
    async def delete_post(
        message_id: int
    ):
        try:
            async with bot as session:
                await session.delete_message(
                    chat_id=settings.TG_CHANEL_NAME,
                    message_id=message_id,
                )

        except Exception as er:
            raise er

    async def post_rollback(
        self,
    ):
        async with bot as session:
            if self.message:
                await session.delete_message(chat_id=settings.TG_CHANEL_NAME, message_id=self.message.message_id)
            else:
                pass