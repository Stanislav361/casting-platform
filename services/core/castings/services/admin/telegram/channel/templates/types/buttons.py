from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from config import settings
from castings.schemas.admin import SCastingData
from shared.services.telegram.channel.templates.types.button import ChannelPostButton


def build_casting_deeplink(casting_id: int) -> str:
    """Build the URL for the "Откликнуться" button under a channel post.

    Связь простая: канал Telegram → приложение. Кнопка ВСЕГДА ведёт прямо на
    страницу кастинга в веб-приложении (`PUBLIC_WEB_URL/cabinet/feed/<id>`),
    где посетитель смотрит кастинг, входит/регистрируется, заполняет профиль и
    откликается. Бот для этого перехода не нужен.

    ВАЖНО: НЕ используем `t.me/<bot>...`-ссылки. Если у бота не настроено
    «главное» Mini App, такая ссылка открывает ЧАТ БОТА вместо приложения —
    именно это и ломало кнопку. Поэтому ведём строго на веб-URL приложения.

    Запасной вариант (только если веб-URL почему-то не задан) — относительный
    путь, чтобы кнопка всё равно куда-то вела.
    """
    web_url = (getattr(settings, "PUBLIC_WEB_URL", "") or "").strip().rstrip("/")
    if web_url:
        return f"{web_url}/cabinet/feed/{casting_id}"
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
