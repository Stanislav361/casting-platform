"""
RBAC Middleware — логирование доступов и аудит.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from log.base import logger


class RBACMiddleware(BaseHTTPMiddleware):
    """
    Middleware для аудита: логирует каждый авторизованный запрос
    с информацией о роли пользователя.
    """

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Аудит-лог для 4xx/5xx на защищённых маршрутах
        if response.status_code in (403, 401):
            auth_header = request.headers.get("Authorization", "none")
            logger.warning(
                "RBAC access denied",
                extra={
                    "path": request.url.path,
                    "method": request.method,
                    "status_code": response.status_code,
                    "auth_header_present": auth_header != "none",
                    "client_ip": request.client.host if request.client else "unknown",
                },
            )

        return response


