import asyncio
import logging
import os
from typing import Awaitable, Callable, Optional, TypeVar, Union
from castings.services.admin.telegram.channel.templates.types.buttons import CastingPostButton
from shared.services.telegram.bot.client import bot
from config import settings
from aiogram.exceptions import TelegramNetworkError, TelegramRetryAfter, TelegramServerError
from aiogram.types import Message, InlineKeyboardMarkup, FSInputFile, BufferedInputFile
from shared.services.telegram.channel.templates.types.post import ChannelPostText
from shared.services.telegram.channel.templates.types.button import ChannelPostButton

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Загрузка обложки занимает секунды, поэтому именно она чаще всего попадает под
# сетевую осечку или троттлинг Telegram. Один такой сбой раньше означал пост без
# картинки, поэтому пробуем ещё раз, прежде чем сдаться.
_SEND_ATTEMPTS = 3
# Публикация происходит внутри HTTP-запроса админа, поэтому долго ждать нельзя:
# при большой задержке от Telegram лучше сразу отдать управление фолбэку.
_MAX_RETRY_DELAY = 5.0


async def _with_retry(operation: Callable[[], Awaitable[T]], what: str) -> T:
    """Повторить запрос к Telegram при сетевом сбое, троттлинге или 5xx.

    Отказы самого Telegram (`TelegramBadRequest` и прочее) не повторяем — они
    воспроизводимы, и повтор только задержит фолбэк на другую картинку.
    """
    last_exc: Optional[Exception] = None
    for attempt in range(1, _SEND_ATTEMPTS + 1):
        try:
            return await operation()
        except TelegramRetryAfter as exc:
            last_exc = exc
            delay = float(getattr(exc, "retry_after", 1) or 1)
            if delay > _MAX_RETRY_DELAY:
                raise
        except (TelegramNetworkError, TelegramServerError) as exc:
            last_exc = exc
            delay = float(attempt)
        if attempt < _SEND_ATTEMPTS:
            logger.warning(
                "telegram %s: попытка %s/%s не удалась (%s); повтор через %.1f c",
                what, attempt, _SEND_ATTEMPTS, last_exc, delay,
            )
            await asyncio.sleep(delay)
    raise last_exc


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


# Ограничения Telegram для sendPhoto: файл до 10 МБ и сумма сторон до 10000 px.
# Если их превысить, Telegram отклоняет фото — и кастинг уходит в канал без
# обложки (или, до исправления, не уходил вовсе).
TELEGRAM_MAX_PHOTO_BYTES = 10 * 1024 * 1024
TELEGRAM_MAX_DIMENSION_SUM = 10000


def _prepare_image_for_telegram(content: bytes) -> bytes:
    """Привести картинку к тому, что Telegram точно примет.

    Сохраняем оригинальные пропорции (фото публикуются «в полный рост»), но
    ужимаем размер сторон и, если нужно, качество JPEG — пока файл не влезет
    в лимит Telegram.
    """
    try:
        from io import BytesIO
        from PIL import Image as PILImage

        with PILImage.open(BytesIO(content)) as img:
            if img.mode != "RGB":
                img = img.convert("RGB")

            w, h = img.size
            if w <= 0 or h <= 0:
                return content

            max_side = 1920
            if w > max_side or h > max_side:
                ratio = min(max_side / w, max_side / h)
                img = img.resize((max(1, int(w * ratio)), max(1, int(h * ratio))), PILImage.LANCZOS)
                w, h = img.size

            if w + h > TELEGRAM_MAX_DIMENSION_SUM:
                ratio = TELEGRAM_MAX_DIMENSION_SUM / (w + h)
                img = img.resize((max(1, int(w * ratio)), max(1, int(h * ratio))), PILImage.LANCZOS)

            data = content
            for quality in (88, 80, 70, 60):
                buf = BytesIO()
                img.save(buf, format="JPEG", quality=quality, optimize=True)
                data = buf.getvalue()
                if len(data) <= TELEGRAM_MAX_PHOTO_BYTES:
                    return data
            return data
    except Exception as exc:  # noqa: BLE001
        logger.warning("prepare image failed (%s); using original image", exc)
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
            prepared = _prepare_image_for_telegram(raw)
            filename = os.path.basename(local_path) or "casting.jpg"
            return BufferedInputFile(prepared, filename=filename)
        except Exception as exc:  # noqa: BLE001 - fall back to plain file upload
            logger.warning(
                "resolve_photo_input: failed to read local %s (%s); sending as-is",
                local_path,
                exc,
            )
            return FSInputFile(local_path)

    if photo_url.startswith("http://") or photo_url.startswith("https://"):
        # Одна сетевая осечка при скачивании обложки не должна лишать кастинг
        # картинки в канале, поэтому пробуем дважды, прежде чем сдаться.
        last_exc: Optional[Exception] = None
        for _attempt in range(2):
            try:
                import httpx

                async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                    resp = await client.get(photo_url)
                    resp.raise_for_status()
                    content = resp.content
                if content:
                    content = _prepare_image_for_telegram(content)
                    filename = os.path.basename(photo_url.split("?", 1)[0]) or "casting.jpg"
                    if not filename.lower().endswith((".jpg", ".jpeg", ".png")):
                        filename = "casting.jpg"
                    return BufferedInputFile(content, filename=filename)
            except Exception as exc:  # network/HTTP errors → retry, then let Telegram try
                last_exc = exc
        logger.warning(
            "resolve_photo_input: failed to download %s (%s); falling back to URL",
            photo_url,
            last_exc,
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
        message = await _with_retry(
            lambda: bot.send_message(
                chat_id=settings.TG_CHANEL_NAME,
                text=self.post_text,
                parse_mode=self.parse_mode,
                reply_markup=self.keyboard,
            ),
            "send_message",
        )
        self.message = message
        return message

    async def send_post_with_image(self, image_url: str) -> Message:
        photo = await resolve_photo_input(image_url)
        if photo is None:
            # Nothing usable resolved — degrade to a text post so the casting
            # still reaches the channel instead of failing outright.
            return await self.send_post_without_image()

        message = await _with_retry(
            lambda: bot.send_photo(
                chat_id=settings.TG_CHANEL_NAME,
                photo=photo,
                caption=self.post_text,
                parse_mode=self.parse_mode,
                reply_markup=self.keyboard,
            ),
            "send_photo",
        )
        self.message = message  # data for rollback
        return message

    async def reply_post(self, message_id: int):
        message = await _with_retry(
            lambda: bot.send_message(
                chat_id=settings.TG_CHANEL_NAME,
                text=self.post_text,
                parse_mode=self.parse_mode,
                reply_to_message_id=message_id,
            ),
            "reply_post",
        )
        self.message = message  # data for rollback

    @staticmethod
    async def delete_post(
        message_id: int
    ):
        await _with_retry(
            lambda: bot.delete_message(
                chat_id=settings.TG_CHANEL_NAME,
                message_id=message_id,
            ),
            "delete_message",
        )

    async def edit_post_text(self, message_id: int) -> Message:
        message = await _with_retry(
            lambda: bot.edit_message_text(
                chat_id=settings.TG_CHANEL_NAME,
                message_id=message_id,
                text=self.post_text,
                parse_mode=self.parse_mode,
                reply_markup=self.keyboard,
            ),
            "edit_message_text",
        )
        self.message = message
        return message

    async def edit_post_caption(self, message_id: int) -> Message:
        message = await _with_retry(
            lambda: bot.edit_message_caption(
                chat_id=settings.TG_CHANEL_NAME,
                message_id=message_id,
                caption=self.post_text,
                parse_mode=self.parse_mode,
                reply_markup=self.keyboard,
            ),
            "edit_message_caption",
        )
        self.message = message
        return message

    async def edit_post_reply_markup(self, message_id: int) -> Message:
        """Обновить только кнопку (inline-клавиатуру) существующего поста —
        работает и для текстовых, и для фото-сообщений. Используется, чтобы
        починить ссылку кнопки «Откликнуться» у уже опубликованных постов."""
        message = await _with_retry(
            lambda: bot.edit_message_reply_markup(
                chat_id=settings.TG_CHANEL_NAME,
                message_id=message_id,
                reply_markup=self.keyboard,
            ),
            "edit_message_reply_markup",
        )
        self.message = message
        return message

    async def post_rollback(
        self,
    ):
        if self.message:
            await self.delete_post(self.message.message_id)
