"""
L7 Security — HTTP Security Headers Middleware.

Устанавливает:
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security
- Referrer-Policy
- Permissions-Policy
- X-XSS-Protection
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from config import settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):

    DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

    async def dispatch(self, request: Request, call_next) -> Response:
        response: Response = await call_next(request)

        if request.url.path in self.DOCS_PATHS:
            return response

        # Защита от кликджекинга
        response.headers["X-Frame-Options"] = "DENY"

        # Защита от MIME-type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS Protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
        )

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy (ограничение API браузера)
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), payment=()"
        )

        # HSTS (только для PROD)
        if settings.MODE == "PROD":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        # Убираем Server header
        if "server" in response.headers:
            del response.headers["server"]

        return response


