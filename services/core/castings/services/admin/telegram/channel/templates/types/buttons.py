from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from urllib.parse import quote
from config import settings
from castings.schemas.admin import SCastingData
from shared.services.telegram.channel.templates.types.button import ChannelPostButton


def _normalize_bot_name(raw: str) -> str:
    """Accept whatever is configured (`@Bot`, `https://t.me/Bot`, `Bot`) and
    return the bare bot username Telegram expects in a deep link."""
    name = (raw or "").strip()
    if not name:
        return ""
    name = name.replace("https://t.me/", "").replace("http://t.me/", "").replace("t.me/", "")
    name = name.lstrip("@")
    # Drop any trailing path/query that might have crept in.
    name = name.split("/", 1)[0].split("?", 1)[0]
    return name


def build_casting_deeplink(casting_id: int) -> str:
    """Build the URL for the "Откликнуться" button under a channel post.

    Связь простая: канал Telegram → PWA. Кнопка ведёт прямо в веб-приложение
    на страницу кастинга (`PUBLIC_WEB_URL/cabinet/feed/<id>`), где посетитель
    может посмотреть кастинг и откликнуться (авторизация — внутри PWA). Бот для
    этого перехода не нужен.

    Запасной вариант (только если веб-URL почему-то не задан) — Telegram-ссылка
    на бота, чтобы кнопка всё равно куда-то вела.
    """
    web_url = (getattr(settings, "PUBLIC_WEB_URL", "") or "").strip().rstrip("/")
    if web_url:
        return f"{web_url}/cabinet/feed/{casting_id}"

    bot_name = _normalize_bot_name(getattr(settings, "TG_BOT_NAME", ""))
    tma_name = _normalize_bot_name(getattr(settings, "TG_TMA_NAME", ""))
    encoded = quote(f"casting_{casting_id}")
    if bot_name and tma_name and tma_name.lower() != bot_name.lower():
        return f"https://t.me/{bot_name}/{tma_name}?startapp={encoded}"
    if bot_name:
        return f"https://t.me/{bot_name}?startapp={encoded}"
    return f"/cabinet/feed/{casting_id}"


class CastingPostButton(ChannelPostButton):
    def __init__(self, casting: SCastingData):
        self._casting = casting

    @property
    def casting(self) -> SCastingData:
        return self._casting

    def get_button(self, ) -> InlineKeyboardMarkup:
        deeplink = build_casting_deeplink(self.casting.id)
        return InlineKeyboardMarkup(
            inline_keyboard=[[InlineKeyboardButton(text="Откликнуться", url=deeplink, )]],
        )
