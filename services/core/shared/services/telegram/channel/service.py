import logging
import os
from typing import Optional, Union
from castings.services.admin.telegram.channel.templates.types.buttons import CastingPostButton
from shared.services.telegram.bot.client import bot
from config import settings
from aiogram.types import Message, InlineKeyboardMarkup, FSInputFile, BufferedInputFile
from shared.services.telegram.channel.templates.types.post import ChannelPostText
from shared.services.telegram.channel.templates.types.button import ChannelPostButton

logger = logging.getLogger(__name__)


def _local_path_for_uploads(photo_url: str) -> Optional[str]:
    """Map a `.../uploads/<rel>` url (or a bare `/uploads/<rel>` path) to a real
    file on disk, if it exists."""
    marker = "/uploads/"
    if marker not in photo_url:
        return None
    relative = photo_url.split(marker, 1)[1]
    uploads_root = os.environ.get("UPLOADS_DIR") or os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "..",
        "..",
        "..",
        "..",
        "uploads",
    )
    local_path = os.path.normpath(os.path.join(uploads_root, relative))
    return local_path if os.path.isfile(local_path) else None


def _resolve_photo_for_telegram(photo_url: str) -> Union[str, FSInputFile]:
    """Return a value Aiogram can send: HTTPS URL stays as-is so Telegram
    fetches it; local /uploads paths are wrapped in FSInputFile so we read
    bytes from disk and upload them directly."""
    if not photo_url:
        return photo_url

    local_path = _local_path_for_uploads(photo_url)
    if local_path:
        return FSInputFile(local_path)

    return photo_url


def _resize_bytes_if_needed(content: bytes) -> bytes:
    """Изменить размер изображения, если оно слишком большое, сохраняя оригинальные пропорции."""
    try:
        from io import BytesIO
        from PIL import Image as PILImage

        with PILImage.open(BytesIO(content)) as img:
            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGB")

            w, h = img.size
            if w <= 0 or h <= 0:
                return content

            max_side = 1920
            if w > max_side or h > max_side:
                ratio = min(max_side / w, max_side / h)
                img = img.resize((int(w * ratio), int(h * ratio)), PILImage.LANCZOS)

            buf = BytesIO()
            img.save(buf, format="JPEG", quality=88, optimize=True)
            return buf.getvalue()
    except Exception as exc:  # noqa: BLE001
        logger.warning("resize failed (%s); using original image", exc)
        return content


async def resolve_photo_input(photo_url: str) -> Union[str, FSInputFile, BufferedInputFile, None]:
    """Resolve a casting image into something Telegram will accept reliably.

    Strategy (most-reliable first):
      1. Local `/uploads/...` file present on disk → read bytes, resize if needed and
         upload as ``BufferedInputFile``.
      2. Any http(s) URL → download the bytes ourselves, resize if needed and upload
         them as ``BufferedInputFile``. We never rely on Telegram fetching the
         URL, which is fragile for private buckets, custom S3 endpoints,
         oversized images or non-standard user agents. Our server can always
         reach the media (it just stored it), so this is the robust path.
      3. If the download fails, fall back to handing Telegram the raw URL so it
         can try on its own (last-resort, keeps old behaviour).

    We keep the original aspect ratio (un-cropped) so images are posted "в полный рост"
    in the Telegram channel.
    """
    if not photo_url:
        return None

    local_path = _local_path_for_uploads(photo_url)
    if local_path:
        try:
            with open(local_path, "rb") as file_obj:
                raw = file_obj.read()
            resized = _resize_bytes_if_needed(raw)
            filename = os.path.basename(local_path) or "casting.jpg"
            return BufferedInputFile(resized, filename=filename)
        except Exception as exc:  # noqa: BLE001 - fall back to plain file upload
            logger.warning(
                "resolve_photo_input: failed to read local %s (%s); sending as-is",
                local_path,
                exc,
            )
            return FSInputFile(local_path)

    if photo_url.startswith("http://") or photo_url.startswith("https://"):
        try:
            import httpx

            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
                resp = await client.get(photo_url)
                resp.raise_for_status()
                content = resp.content
                if content:
                    content = _resize_bytes_if_needed(content)
                    filename = os.path.basename(photo_url.split("?", 1)[0]) or "casting.jpg"
                    if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
                        filename = "casting.jpg"
                    return BufferedInputFile(content, filename=filename)
        except Exception as exc:  # network/HTTP errors → let Telegram try the URL
            logger.warning(
                "resolve_photo_input: failed to download %s (%s); falling back to URL",
                photo_url,
                exc,
            )
        return photo_url

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
            photo = await resolve_photo_input(image_url)
            if photo is None:
                # Nothing usable resolved — degrade to a text post so the casting
                # still reaches the channel instead of failing outright.
                return await self.send_post_without_image()
            async with bot as session:
                message = await session.send_photo(
                    chat_id=settings.TG_CHANEL_NAME,
                    photo=photo,
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

    async def edit_post_reply_markup(self, message_id: int) -> Message:
        """Обновить только кнопку (inline-клавиатуру) существующего поста —
        работает и для текстовых, и для фото-сообщений. Используется, чтобы
        починить ссылку кнопки «Откликнуться» у уже опубликованных постов."""
        async with bot as session:
            message = await session.edit_message_reply_markup(
                chat_id=settings.TG_CHANEL_NAME,
                message_id=message_id,
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