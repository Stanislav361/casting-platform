"""
Единый источник правды по доверенным Origin'ам.

Список используют сразу две защиты:
- CORS — кому браузер разрешит ПРОЧИТАТЬ ответ нашего API;
- CSRF — кому мы разрешим ВЫПОЛНИТЬ изменяющий запрос.

Раньше список задавался регекспом, в который попадал весь `*.up.railway.app`.
Поддомен там может бесплатно получить любой человек за пару минут, то есть
любой чужой сайт на Railway считался доверенным: он мог отправить запрос с
нашей refresh-cookie и прочитать ответ с новым access-токеном. Поэтому здесь
только явные адреса из ALLOWED_HOSTS, а регексп остался лишь для localhost и
только вне продакшена.
"""
from __future__ import annotations

from functools import lru_cache
from urllib.parse import urlsplit

from config import settings

# Локальная разработка. В PROD не применяется вообще.
LOCALHOST_ORIGIN_REGEX = r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"

_LOCALHOST_HOSTNAMES = frozenset({"localhost", "127.0.0.1", "::1"})


def _normalize(value: str | None) -> str:
    """Приводим Origin к каноничному виду: без пробелов, слеша и регистра."""
    return (value or "").strip().rstrip("/").lower()


def _to_origin(url: str | None) -> str | None:
    """Origin (scheme://host[:port]) из произвольного URL."""
    normalized = _normalize(url)
    if not normalized:
        return None
    parts = urlsplit(normalized)
    if not parts.scheme or not parts.netloc:
        return None
    return f"{parts.scheme}://{parts.netloc}"


@lru_cache(maxsize=1)
def get_allowed_origins() -> tuple[str, ...]:
    """Явный список доверенных источников."""
    origins: set[str] = set()

    for host in (settings.ALLOWED_HOSTS or "").split(","):
        origin = _to_origin(host)
        if origin:
            origins.add(origin)

    # Собственный публичный адрес фронтенда всегда доверенный: именно он
    # прописан в письмах и постах канала.
    public_web_origin = _to_origin(getattr(settings, "PUBLIC_WEB_URL", None))
    if public_web_origin:
        origins.add(public_web_origin)

    return tuple(sorted(origins))


def get_allowed_origin_regex() -> str | None:
    """Регексп-исключение для локальной разработки (в PROD — выключено)."""
    if settings.MODE == "PROD":
        return None
    return LOCALHOST_ORIGIN_REGEX


def is_trusted_origin(origin: str | None) -> bool:
    """Доверяем ли источнику запроса."""
    normalized = _to_origin(origin)
    if not normalized:
        return False

    if normalized in get_allowed_origins():
        return True

    if settings.MODE != "PROD":
        hostname = urlsplit(normalized).hostname
        if hostname in _LOCALHOST_HOSTNAMES:
            return True

    return False


def origin_of(url: str | None) -> str | None:
    """Origin из полного URL — нужен для разбора заголовка Referer."""
    return _to_origin(url)
