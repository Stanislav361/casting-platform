import os
from typing import Optional, Union
from castings.services.admin.telegram.channel.templates.types.buttons import CastingPostButton
from shared.services.telegram.bot.client import bot
from config import settings
from aiogram.types import Message, InlineKeyboardMarkup, FSInputFile
from shared.services.telegram.channel.templates.types.post import ChannelPostText
from shared.services.telegram.channel.templates.types.button import ChannelPostButton


def _resolve_photo_for_telegram(photo_url: str) -> Union[str, FSInputFile]:
    """Return a value Aiogram can send: HTTPS URL stays as-is so Telegram
    fetches it; local /uploads paths are wrapped in FSInputFile so we read
    bytes from disk and upload them directly."""
    if not photo_url:
        return photo_url
    if photo_url.startswith("http://") or photo_url.startswith("https://"):
        return photo_url

    marker = "/uploads/"
    if marker in photo_url:
        relative = photo_url.split(marker, 1)[1]
        uploads_root = os.environ.get("UPLOADS_DIR") or os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "..",
            "..",
            "..",
            "uploads",
        )
        local_path = os.path.normpath(os.path.join(uploads_root, relative))
        if os.path.isfile(local_path):
            return FSInputFile(local_path)
    return photo_url


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
                    photo=_resolve_photo_for_telegram(image_url),
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

    async def edit_post_text(self, message_id: int) -> Message:
        async with bot as session:
            message = await session.edit_message_text(
                chat_id=settings.TG_CHANEL_NAME,
                message_id=message_id,
                text=self.post_text,
                parse_mode=self.parse_mode,
                reply_markup=self.keyboard,
            )
            self.message = message
            return message

    async def edit_post_caption(self, message_id: int) -> Message:
        async with bot as session:
            message = await session.edit_message_caption(
                chat_id=settings.TG_CHANEL_NAME,
                message_id=message_id,
                caption=self.post_text,
                parse_mode=self.parse_mode,
                reply_markup=self.keyboard,
            )
            self.message = message
            return message

    async def post_rollback(
        self,
    ):
        async with bot as session:
            if self.message:
                await session.delete_message(chat_id=settings.TG_CHANEL_NAME, message_id=self.message.message_id)
            else:
                pass