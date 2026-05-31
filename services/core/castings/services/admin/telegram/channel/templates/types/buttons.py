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
    """Build the Telegram Mini App deep link for the "Откликнуться" button.

    Two valid forms depending on how the bot is configured in BotFather:
      * Named Mini App (created via /newapp):  t.me/<bot>/<app>?startapp=<param>
      * Main Mini App  (Bot Settings → Configure Mini App): t.me/<bot>?startapp=<param>

    We use the named form when `TG_TMA_NAME` is set, otherwise fall back to the
    Main Mini App form so the link still opens the app instead of a chat.
    """
    bot_name = _normalize_bot_name(getattr(settings, "TG_BOT_NAME", ""))
    tma_name = _normalize_bot_name(getattr(settings, "TG_TMA_NAME", ""))
    encoded = quote(f"casting_{casting_id}")
    if tma_name:
        return f"https://t.me/{bot_name}/{tma_name}?startapp={encoded}"
    return f"https://t.me/{bot_name}?startapp={encoded}"


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
