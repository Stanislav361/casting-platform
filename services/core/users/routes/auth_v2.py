"""
Auth V2 Routes — Email/Password + OTP + Profile Switch.

Telegram остаётся как опциональный метод связки.
"""
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status, Body, UploadFile
from pathlib import Path
from sqlalchemy import select

from users.schemas.email_auth import (
    SEmailPasswordLogin,
    SEmailPasswordRegister,
    SOTPSend,
    SOTPVerify,
    SOTPSendResponse,
    SAuthTokenResponse,
    SProfileSwitch,
    SCurrentUserData,
    SCurrentUserUpdate,
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
from users.services.authentication.types.email_auth import PasswordHasher
from users.models import User
from postgres.database import transaction
from config import settings
from shared.services.s3.services.media import S3MediaService


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
        self.s3_media = S3MediaService(directory='agent-media')
        self.include_routers()

    def include_routers(self):
        self.add_register_route()
        self.add_login_route()
        self.add_otp_send_route()
        self.add_otp_verify_route()
        self.add_refresh_route()
        self.add_switch_profile_route()
        self.add_get_me_route()
        self._add_init_owner_route()
        self.add_update_me_route()
        self.add_upload_me_photo_route()
        self.add_change_password_route()
        self.add_change_email_route()

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

    def add_get_me_route(self):
        @self.router.get("/me/", response_model=SCurrentUserData)
        async def get_me(
            authorized: JWT = Depends(tma_authorized),
        ) -> SCurrentUserData:
            """Получить текущего пользователя."""
            from postgres.database import async_session_maker

            async with async_session_maker() as session:
                user = await session.get(User, int(authorized.id))
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")

            return SCurrentUserData(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone_number=user.phone_number,
                photo_url=user.photo_url,
                role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            )

    def add_update_me_route(self):
        @self.router.patch("/me/", response_model=SCurrentUserData)
        async def update_me(
            data: SCurrentUserUpdate,
            authorized: JWT = Depends(tma_authorized),
        ) -> SCurrentUserData:
            """Обновить данные текущего пользователя (имя/фамилия)."""
            from postgres.database import async_session_maker

            async with async_session_maker() as session:
                user = await session.get(User, int(authorized.id))
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")

                if data.first_name is not None:
                    user.first_name = data.first_name
                if data.last_name is not None:
                    user.last_name = data.last_name
                if data.phone_number is not None:
                    user.phone_number = data.phone_number

                session.add(user)
                await session.commit()

            return SCurrentUserData(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone_number=user.phone_number,
                photo_url=user.photo_url,
                role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            )

    def add_upload_me_photo_route(self):
        @self.router.post("/me/photo/", response_model=SCurrentUserData)
        async def upload_me_photo(
            request: Request,
            file: UploadFile,
            authorized: JWT = Depends(tma_authorized),
        ) -> SCurrentUserData:
            """Загрузить фото текущего пользователя (агента)."""
            if not file.content_type or not file.content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="Only image files are allowed")

            file_bytes = await file.read()
            if not file_bytes:
                raise HTTPException(status_code=400, detail="Empty file")

            ext = "jpg"
            if file.filename and "." in file.filename:
                ext = file.filename.rsplit(".", 1)[1].lower()
            file_name = f"{authorized.id}/avatar_{authorized.id}.{ext}"
            try:
                await self.s3_media.upload_file(file_name=file_name, file=file_bytes)
                photo_url = f"{self.s3_media.base_url}/{file_name}"
            except Exception:
                # Fallback for local/dev when S3 endpoint is unavailable.
                core_root = Path(__file__).resolve().parents[2]
                target = core_root / "uploads" / "agent-media" / str(authorized.id)
                target.mkdir(parents=True, exist_ok=True)
                local_file = target / f"avatar_{authorized.id}.{ext}"
                local_file.write_bytes(file_bytes)
                photo_url = f"{str(request.base_url).rstrip('/')}/uploads/agent-media/{authorized.id}/avatar_{authorized.id}.{ext}"

            from postgres.database import async_session_maker
            async with async_session_maker() as session:
                user = await session.get(User, int(authorized.id))
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.photo_url = photo_url
                session.add(user)
                await session.commit()

            return SCurrentUserData(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                phone_number=user.phone_number,
                photo_url=user.photo_url,
                role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            )

    def add_change_password_route(self):
        @self.router.post("/change-password/")
        async def change_password(
            request: Request,
            current_password: str = Body(...),
            new_password: str = Body(..., min_length=8),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Смена пароля."""
            user_id = int(authorized.id)
            async with transaction() as session:
                user = await session.get(User, user_id)
                if not user or not user.password_hash:
                    raise HTTPException(status_code=400, detail="Account has no password")

                if not PasswordHasher.verify_password(current_password, user.password_hash):
                    raise HTTPException(status_code=401, detail="Current password is incorrect")

                user.password_hash = PasswordHasher.hash_password(new_password)
                session.add(user)
            return {"message": "Password changed successfully"}

    def add_change_email_route(self):
        @self.router.post("/change-email/")
        async def change_email(
            request: Request,
            new_email: str = Body(...),
            password: str = Body(...),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Смена email."""
            user_id = int(authorized.id)
            async with transaction() as session:
                user = await session.get(User, user_id)
                if not user or not user.password_hash:
                    raise HTTPException(status_code=400, detail="Account has no password")

                if not PasswordHasher.verify_password(password, user.password_hash):
                    raise HTTPException(status_code=401, detail="Password is incorrect")

                existing = await session.execute(
                    select(User).where(User.email == new_email)
                )
                if existing.scalar_one_or_none():
                    raise HTTPException(status_code=409, detail="Email already taken")

                user.email = new_email
                session.add(user)
            return {"message": "Email changed successfully", "new_email": new_email}

    def _add_init_owner_route(self):
        @self.router.post("/init-owner/")
        async def init_owner(email: str):
            """One-time owner setup. Only works if no owner exists yet."""
            async with transaction() as session:
                existing_owner = await session.execute(
                    select(User).where(User.role == "owner")
                )
                if existing_owner.scalar_one_or_none():
                    raise HTTPException(status_code=409, detail="Owner already exists")
                result = await session.execute(select(User).where(User.email == email))
                user = result.scalar_one_or_none()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.role = "owner"
                session.add(user)
            return {"message": f"User {email} promoted to owner"}
