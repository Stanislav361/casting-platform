"""
Auth V2 Routes — Email/Password + OTP + Profile Switch.

Telegram остаётся как опциональный метод связки.
"""
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status

from users.schemas.email_auth import (
    SEmailPasswordLogin,
    SEmailPasswordRegister,
    SOTPSend,
    SOTPVerify,
    SOTPSendResponse,
    SAuthTokenResponse,
    SProfileSwitch,
)
from users.services.authentication.types.email_auth import (
    EmailPasswordAuthType,
    EmailOTPAuthType,
    UserRegistrationService,
)
from users.services.auth_token.service import TokenService
from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import admin_authorized, tma_authorized
from security.rate_limit import auth_rate_limiter, otp_rate_limiter
from config import settings


class AuthV2Router:
    """
    Независимый Auth Service v2.

    Провайдеры:
    - Email/Password
    - OTP (Email/SMS)
    - Telegram (legacy, сохраняется)
    """

    def __init__(self):
        self.router = APIRouter(prefix="/auth/v2", tags=["auth-v2"])
        self.include_routers()

    def include_routers(self):
        self.add_register_route()
        self.add_login_route()
        self.add_otp_send_route()
        self.add_otp_verify_route()
        self.add_refresh_route()
        self.add_switch_profile_route()

    def add_register_route(self):
        @self.router.post("/register/", response_model=SAuthTokenResponse)
        async def register(
            data: SEmailPasswordRegister,
            request: Request,
            response: Response,
        ) -> SAuthTokenResponse:
            """Регистрация через Email/Password."""
            # Rate limiting
            await auth_rate_limiter.check(request)

            user = await UserRegistrationService.register(
                email=data.email,
                password=data.password,
                first_name=data.first_name,
                last_name=data.last_name,
            )

            auth_method = EmailPasswordAuthType(request=request, response=response)
            token = await auth_method.authenticate_user(
                email=data.email,
                password=data.password,
            )

            return SAuthTokenResponse(access_token=str(token))

    def add_login_route(self):
        @self.router.post("/login/", response_model=SAuthTokenResponse)
        async def login(
            data: SEmailPasswordLogin,
            request: Request,
            response: Response,
        ) -> SAuthTokenResponse:
            """Вход через Email/Password."""
            await auth_rate_limiter.check(request)

            auth_method = EmailPasswordAuthType(request=request, response=response)
            token = await auth_method.authenticate_user(
                email=data.email,
                password=data.password,
            )

            return SAuthTokenResponse(access_token=str(token))

    def add_otp_send_route(self):
        @self.router.post("/otp/send/", response_model=SOTPSendResponse)
        async def send_otp(
            data: SOTPSend,
            request: Request,
            response: Response,
        ) -> SOTPSendResponse:
            """Отправить OTP-код на email/телефон."""
            await otp_rate_limiter.check(request)

            auth_method = EmailOTPAuthType(request=request, response=response)
            result = await auth_method.send_otp(email=data.destination)

            return SOTPSendResponse(**result)

    def add_otp_verify_route(self):
        @self.router.post("/otp/verify/", response_model=SAuthTokenResponse)
        async def verify_otp(
            data: SOTPVerify,
            request: Request,
            response: Response,
        ) -> SAuthTokenResponse:
            """Верификация OTP и получение токенов."""
            await auth_rate_limiter.check(request)

            auth_method = EmailOTPAuthType(request=request, response=response)
            token = await auth_method.authenticate_user(
                email=data.destination,
                code=data.code,
            )

            return SAuthTokenResponse(access_token=str(token))

    def add_refresh_route(self):
        @self.router.post("/refresh/", response_model=SAuthTokenResponse)
        async def refresh_token(
            request: Request,
            response: Response,
        ) -> SAuthTokenResponse:
            """Обновление Access Token через Refresh Token."""
            token = TokenService.refresh_access_token(
                request=request,
                container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
            )
            return SAuthTokenResponse(access_token=str(token))

    def add_switch_profile_route(self):
        @self.router.post("/switch-profile/", response_model=SAuthTokenResponse)
        async def switch_profile(
            data: SProfileSwitch,
            request: Request,
            response: Response,
            authorized: JWT = Depends(tma_authorized),
        ) -> SAuthTokenResponse:
            """
            Переключение профиля без повторной авторизации.
            Выпускает новую пару токенов с указанным profile_id.
            """
            user_id = authorized.id
            profile_id = data.profile_id

            # Проверяем, что профиль принадлежит пользователю
            from users.models import ActorProfile
            from sqlalchemy import select
            from postgres.database import async_session_maker

            async with async_session_maker() as session:
                stmt = select(ActorProfile).filter_by(
                    id=profile_id,
                    user_id=int(user_id),
                    is_active=True,
                    is_deleted=False,
                )
                result = await session.execute(stmt)
                profile = result.scalar_one_or_none()

            if not profile:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Profile not found or does not belong to this user"},
                )

            # Генерируем новые токены с новым profile_id
            role = authorized.role
            TokenService.set_refresh_token(
                response=response,
                user_id=str(user_id),
                role=role,
                profile_id=str(profile_id),
                container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
            )
            token = TokenService.generate_access_token(
                user_id=str(user_id),
                profile_id=str(profile_id),
                role=role,
            )

            return SAuthTokenResponse(access_token=str(token))


