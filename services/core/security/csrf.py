"""
CSRF-защита для cross-origin JSON API.

Как устроена авторизация в приложении:
- обычные запросы идут с заголовком `Authorization: Bearer <access>`, который
  чужой сайт подставить не может — они CSRF-безопасны сами по себе;
- но `/auth/v2/refresh/` авторизуется ТОЛЬКО httpOnly-cookie, а она обязана
  быть `SameSite=None` (фронт и API живут на разных доменах). Значит браузер
  отправит её и с чужого сайта тоже.

Без проверки источника это классический CSRF: сторонняя страница молча
ротирует чужую сессию, а если её Origin ещё и попадает в CORS-список — читает
ответ со свежим access-токеном, то есть полностью захватывает аккаунт.

Поэтому у каждого изменяющего запроса (POST/PUT/PATCH/DELETE) проверяем
источник:
- если браузер прислал `Origin` — он обязан быть в списке доверенных;
- если `Origin` нет (браузеры всегда шлют его для межсайтовых изменяющих
  запросов), но запрос всё же несёт нашу авторизационную cookie — требуем
  доверенный `Referer`.

Серверные интеграции (вебхуки Telegram и платёжной системы, cron, curl) не
присылают `Origin` и не носят наши cookie, поэтому продолжают работать.
"""
from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from config import settings
from security.origins import is_trusted_origin, origin_of

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


class CSRFProtectionMiddleware(BaseHTTPMiddleware):
    """Проверка источника изменяющих запросов."""

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method.upper() in SAFE_METHODS:
            return await call_next(request)

        origin = request.headers.get("origin")
        if origin:
            if not is_trusted_origin(origin):
                return self._rejected("Запрос отклонён: источник не доверенный.")
            return await call_next(request)

        if self._carries_auth_cookie(request):
            referer_origin = origin_of(request.headers.get("referer"))
            if not is_trusted_origin(referer_origin):
                return self._rejected("Запрос отклонён: не подтверждён источник запроса.")

        return await call_next(request)

    @staticmethod
    def _carries_auth_cookie(request: Request) -> bool:
        """Опирается ли запрос на нашу cookie-авторизацию."""
        cookie_names = (
            settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
            settings.REFRESH_TMA_TOKEN_CONTAINER_NAME,
        )
        return any(name and name in request.cookies for name in cookie_names)

    @staticmethod
    def _rejected(message: str) -> JSONResponse:
        return JSONResponse(status_code=403, content={"detail": message})
