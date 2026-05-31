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

    Preferred form — a direct link to the casting page on the public web app.
    This works without any BotFather Mini App configuration: tapping it opens
    the casting in the browser, where our normal login / respond flow takes
    over. Set ``PUBLIC_WEB_URL`` to enable this (default: prostoprobuy.pro).

    Fallback — the Telegram Mini App deep link, used only when no public web
    URL is configured:
      * Named Mini App (created via /newapp):  t.me/<bot>/<app>?startapp=<param>
      * Main Mini App  (Bot Settings → Configure Mini App): t.me/<bot>?startapp=<param>
    """
    web_url = (getattr(settings, "PUBLIC_WEB_URL", "") or "").strip().rstrip("/")
    if web_url:
        return f"{web_url}/cabinet/feed/{casting_id}"

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
