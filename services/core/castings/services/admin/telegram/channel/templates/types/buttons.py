from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from config import settings
from castings.schemas.admin import SCastingData
from shared.services.telegram.channel.templates.types.button import ChannelPostButton


DEFAULT_PUBLIC_WEB_URL = "https://prostoprobuy.pro"


def public_web_base_url() -> str:
    """Абсолютный базовый URL приложения без завершающего слэша.

    Значение `PUBLIC_WEB_URL` может оказаться пустым или без схемы — такой
    адрес дотягиваем до корректного вида. Этот URL уходит и в кнопку поста, и в
    ссылку на обложку, которую скачивает Telegram: в обоих случаях
    относительный адрес ломает отправку.
    """
    web_url = (getattr(settings, "PUBLIC_WEB_URL", "") or "").strip().rstrip("/")
    if not web_url:
        return DEFAULT_PUBLIC_WEB_URL
    if not web_url.startswith(("http://", "https://")):
        return f"https://{web_url}"
    return web_url


def _bot_username() -> str:
    return (getattr(settings, "TG_BOT_NAME", "") or "").strip().lstrip("@")


def _mini_app_short_name() -> str:
    return (getattr(settings, "TG_TMA_NAME", "") or "").strip().strip("/")


def build_casting_deeplink(casting_id: int) -> str:
    """URL кнопки «Откликнуться» под постом в канале.

    В канале Telegram разрешены только url-кнопки, не web_app. Обычный адрес
    сайта (`https://prostoprobuy.pro/cabinet/feed/<id>`) на Android открывается
    во встроенном браузере Telegram: страница либо не появляется, либо остаётся
    чёрной — service worker PWA в этом WebView ломает загрузку. На iOS тот же
    URL часто открывается нормально, поэтому жалоба звучала как «только
    Android».

    Правильная ссылка для канала — Mini App:
    `https://t.me/<bot>/<app>?startapp=casting_<id>`. Клиент открывает её как
    приложение, а не как сайт; фронт читает start_param и ведёт на карточку
    кастинга. Если короткое имя Mini App не задано, остаётся веб-адрес, чтобы
    кнопка вообще работала.

    Ссылка обязана быть абсолютной и со схемой: Telegram отклоняет кнопку с
    относительным URL (BUTTON_URL_INVALID), а вместе с кнопкой не проходит и
    весь пост.
    """
    bot = _bot_username()
    app = _mini_app_short_name()
    start = f"casting_{int(casting_id)}"
    if bot and app:
        return f"https://t.me/{bot}/{app}?startapp={start}"
    if bot:
        return f"https://t.me/{bot}?startapp={start}"
    return f"{public_web_base_url()}/cabinet/feed/{int(casting_id)}"


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
