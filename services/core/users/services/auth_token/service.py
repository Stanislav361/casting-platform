from config import settings
from typing import Optional
from fastapi import Request, Response
from users.services.auth_token.services.jwt import JWTService
from users.services.auth_token.services.refresh import RefreshTokenService
from users.services.auth_token.types.jwt import JWT
from users.services.auth_token.types.refresh import RefreshToken
from users.services.authentication.exceptions import ExpiredAccessToken, ExpiredRefreshToken, AuthenticationFailed
from typing import Optional, TypeVar, Generic
from datetime import datetime, timedelta, timezone

class TokenService:

    @staticmethod
    def generate_access_token(user_id: str, profile_id, role: str) -> JWT:
        return JWTService.generate(user_id=user_id, profile_id=profile_id,role=role)

    @staticmethod
    def set_refresh_token(response: Response, container: str, user_id: str, role: str, profile_id: str) -> None:
        # Фронт (prostoprobuy.pro / *.up.railway.app) и API живут на РАЗНЫХ
        # доменах — это cross-origin. Поэтому refresh-cookie обязана быть
        # SameSite=None; Secure, иначе браузер НЕ отправит её в запрос
        # /auth/v2/refresh/, и при истечении access-токена пользователя выкинет
        # (придётся логиниться заново). На LOCAL (http) SameSite=None недоступен
        # без Secure — там используем Lax на localhost (это same-site).
        #
        # max_age (целое число секунд) вместо expires: раньше в expires
        # передавалась строка с unix-timestamp, которая не является валидной
        # HTTP-датой — браузер её игнорировал, и cookie становилась сессионной
        # (умирала при полном закрытии приложения/браузера). Из-за этого вход
        # не сохранялся между запусками. max_age делает cookie постоянной.
        is_https = settings.MODE in ('PROD', 'DEV')
        max_age = max(settings.REFRESH_TOKEN_EXPIRE_DAYS, 365) * 24 * 60 * 60
        response.set_cookie(
            key=container,
            value=str(RefreshTokenService.generate(user_id=user_id, role=role, profile_id=profile_id)),
            max_age=max_age,
            httponly=True,
            samesite="none" if is_https else "lax",
            secure=is_https,
            path="/",
        )

    @staticmethod
    def validate_access_token(request: Request) -> Optional[JWT]:
        token = request.headers.get(settings.ACCESS_TOKEN_HEADER_NAME)
        if not token:
            raise AuthenticationFailed().API_ERR
        try:
            return JWTService.verify(token=token)
        except ExpiredAccessToken:
            raise ExpiredAccessToken().API_ERR

    @staticmethod
    def validate_refresh_token(request: Request, container: str) -> Optional[RefreshToken]:
        refresh_token = request.cookies.get(container)
        if not refresh_token:
            raise AuthenticationFailed().API_ERR
        try:
            return RefreshTokenService.verify(token=refresh_token)
        except ExpiredRefreshToken:
            raise ExpiredRefreshToken().API_ERR

    @staticmethod
    def refresh_access_token(request: Request, container: str) -> Optional[JWT]:
        try:
            refresh_token = TokenService.validate_refresh_token(request=request, container=container)
            return TokenService.generate_access_token(
                user_id=refresh_token.id,
                role=refresh_token.role,
                profile_id=refresh_token.profile_id
            )
        except ExpiredRefreshToken:
            raise ExpiredRefreshToken().API_ERR