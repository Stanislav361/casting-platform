"""
Auth V2 Routes — Email/Password + OTP + Profile Switch.

Telegram остаётся как опциональный метод связки.
"""
from fastapi import APIRouter, Depends, Request, Response, HTTPException, status, Body, UploadFile
from pathlib import Path
from sqlalchemy import select, func, delete as sa_delete

from users.schemas.email_auth import (
    SEmailPasswordLogin,
    SEmailPasswordRegister,
    SEmailPasswordRegisterVerify,
    SPasswordResetRequest,
    SPasswordResetConfirm,
    SRegistrationStartResponse,
    SOTPSend,
    SOTPVerify,
    SOTPSendResponse,
    SPhoneOTPSend,
    SPhoneOTPVerify,
    SAuthTokenResponse,
    SProfileSwitch,
    SCurrentUserData,
    SCurrentUserUpdate,
)
from users.services.authentication.types.email_auth import (
    EmailPasswordAuthType,
    EmailOTPAuthType,
    PhoneOTPAuthType,
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
from shared.services.sms.service import SMSDeliveryService
from shared.services.email.service import EmailDeliveryService


def _get_available_casting_notification_channels(user: User) -> list[str]:
    channels = ["in_app"]
    if user.email:
        channels.append("email")
    if user.phone_number and SMSDeliveryService.is_configured():
        channels.append("sms")
    if getattr(user, "telegram_id", None) and settings.TG_BOT_TOKEN:
        channels.append("telegram")
    return channels


def _serialize_current_user(user: User) -> SCurrentUserData:
    raw_tg_username = getattr(user, 'telegram_username', None)
    tg_nick = getattr(user, 'telegram_nick', None)
    if not tg_nick and raw_tg_username:
        tg_nick = raw_tg_username if raw_tg_username.startswith('@') else f'@{raw_tg_username}'
    return SCurrentUserData(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        middle_name=getattr(user, 'middle_name', None),
        phone_number=user.phone_number,
        photo_url=user.photo_url,
        telegram_nick=tg_nick,
        telegram_username=raw_tg_username,
        vk_nick=getattr(user, 'vk_nick', None),
        max_nick=getattr(user, 'max_nick', None),
        telegram_connected=bool(getattr(user, 'telegram_id', None)),
        casting_notification_channel=getattr(user, 'casting_notification_channel', 'in_app') or 'in_app',
        available_casting_notification_channels=_get_available_casting_notification_channels(user),
        role=user.role.value if hasattr(user.role, 'value') else str(user.role),
    )


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
        self.add_register_verify_route()
        self.add_login_route()
        self.add_password_reset_request_route()
        self.add_password_reset_confirm_route()
        self.add_otp_send_route()
        self.add_otp_verify_route()
        self.add_phone_otp_send_route()
        self.add_phone_otp_verify_route()
        self.add_refresh_route()
        self.add_switch_profile_route()
        self.add_get_me_route()
        self._add_init_owner_route()
        self.add_update_me_route()
        self.add_upload_me_photo_route()
        self.add_change_password_route()
        self.add_change_email_route()
        self.add_delete_me_route()

    def add_register_route(self):
        @self.router.post("/register/", response_model=SRegistrationStartResponse)
        async def register(
            data: SEmailPasswordRegister,
            request: Request,
            response: Response,
        ) -> SRegistrationStartResponse:
            """Начать регистрацию через Email/Password: создать аккаунт и отправить код."""
            await auth_rate_limiter.check(request)

            user = await UserRegistrationService.register(
                email=data.email,
                password=data.password,
                first_name=data.first_name,
                last_name=data.last_name,
                middle_name=getattr(data, 'middle_name', None),
                phone_number=getattr(data, 'phone_number', None),
                telegram_nick=getattr(data, 'telegram_nick', None),
                vk_nick=getattr(data, 'vk_nick', None),
                max_nick=getattr(data, 'max_nick', None),
            )

            from users.services.authentication.types.email_auth import OTPService
            otp = await OTPService.create_otp(
                destination=data.email,
                destination_type='registration_email',
                user_id=user.id,
            )

            delivered = False
            if EmailDeliveryService.is_configured():
                try:
                    await EmailDeliveryService.send_notification_email(
                        to_email=data.email,
                        subject="Код подтверждения prostoprobuy",
                        message=f"Ваш код подтверждения регистрации: {otp.code}\n\nКод действует 10 минут.",
                    )
                    delivered = True
                except Exception:
                    delivered = False

            # Код уходит только на почту и никогда не возвращается в ответе
            # (так же, как при восстановлении пароля). Если письмо не удалось
            # доставить — отдаём явную ошибку, а не показываем код в приложении.
            # В LOCAL/DEV возвращаем код для удобства разработки.
            if not delivered and settings.MODE not in ['LOCAL', 'DEV']:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Не удалось отправить код на email. Попробуйте позже или обратитесь в поддержку.",
                )

            include_code = settings.MODE in ['LOCAL', 'DEV']

            return SRegistrationStartResponse(
                message="Код отправлен на email",
                destination=data.email,
                code=otp.code if include_code else None,
            )

    def add_register_verify_route(self):
        @self.router.post("/register/verify/", response_model=SAuthTokenResponse)
        async def verify_register(
            data: SEmailPasswordRegisterVerify,
            request: Request,
            response: Response,
        ) -> SAuthTokenResponse:
            """Подтвердить регистрацию email-кодом и получить токен."""
            await auth_rate_limiter.check(request)

            from users.services.authentication.types.email_auth import OTPService

            # Проверка кода и активация аккаунта в одной транзакции:
            # код помечается использованным только если регистрация
            # полностью завершилась успешно.
            async with transaction() as session:
                is_valid = await OTPService.verify_otp(
                    session=session,
                    destination=data.email,
                    destination_type='registration_email',
                    code=data.code,
                )
                if not is_valid:
                    raise HTTPException(status_code=400, detail="Неверный или просроченный код")

                result = await session.execute(select(User).where(User.email == data.email, User.is_deleted == False))
                user = result.scalar_one_or_none()
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.is_active = True
                session.add(user)

            auth_method = EmailPasswordAuthType(request=request, response=response)
            # Account is active now; issue token without asking password again.
            token = await auth_method._get_tokens(user=user, profile_id=0)

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

    def add_password_reset_request_route(self):
        @self.router.post("/password-reset/request/", response_model=SOTPSendResponse)
        async def request_password_reset(
            data: SPasswordResetRequest,
            request: Request,
        ) -> SOTPSendResponse:
            """Запросить код восстановления пароля на email."""
            await otp_rate_limiter.check(request)
            generic = SOTPSendResponse(
                message="Если аккаунт с таким email существует, мы отправили код восстановления.",
                destination=data.email,
            )

            async with transaction() as session:
                user = (await session.execute(
                    select(User).where(
                        User.email == data.email,
                        User.is_deleted == False,  # noqa: E712
                    )
                )).scalar_one_or_none()

            if not user or not getattr(user, 'password_hash', None):
                return generic

            from users.services.authentication.types.email_auth import OTPService
            otp = await OTPService.create_otp(
                destination=data.email,
                destination_type='password_reset_email',
                user_id=user.id,
            )

            delivered = False
            if EmailDeliveryService.is_configured():
                try:
                    await EmailDeliveryService.send_notification_email(
                        to_email=data.email,
                        subject="Восстановление пароля prostoprobuy",
                        message=(
                            f"Ваш код восстановления пароля: {otp.code}\n\n"
                            "Код действует 10 минут. Если вы не запрашивали восстановление, просто игнорируйте это письмо."
                        ),
                    )
                    delivered = True
                except Exception:
                    delivered = False

            if not delivered:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Email-сервис временно недоступен. Попробуйте позже или обратитесь в поддержку.",
                )

            return generic

    def add_password_reset_confirm_route(self):
        @self.router.post("/password-reset/confirm/")
        async def confirm_password_reset(
            data: SPasswordResetConfirm,
            request: Request,
        ):
            """Подтвердить код восстановления и задать новый пароль."""
            await auth_rate_limiter.check(request)

            from users.services.authentication.types.email_auth import OTPService
            async with transaction() as session:
                is_valid = await OTPService.verify_otp(
                    session=session,
                    destination=data.email,
                    destination_type='password_reset_email',
                    code=data.code,
                )
                if not is_valid:
                    raise HTTPException(status_code=400, detail="Неверный или просроченный код")

                user = (await session.execute(
                    select(User).where(
                        User.email == data.email,
                        User.is_deleted == False,  # noqa: E712
                    )
                )).scalar_one_or_none()
                if not user or not user.password_hash:
                    raise HTTPException(status_code=404, detail="Аккаунт для восстановления не найден")

                user.password_hash = PasswordHasher.hash_password(data.new_password)
                user.is_active = True
                session.add(user)

            return {"message": "Пароль успешно изменён"}

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

    def add_phone_otp_send_route(self):
        @self.router.post("/otp/phone/send/", response_model=SOTPSendResponse)
        async def send_phone_otp(
            data: SPhoneOTPSend,
            request: Request,
            response: Response,
        ) -> SOTPSendResponse:
            """Отправить OTP-код на телефон (SMS)."""
            await otp_rate_limiter.check(request)

            auth_method = PhoneOTPAuthType(request=request, response=response)
            result = await auth_method.send_otp(phone=data.phone)

            return SOTPSendResponse(**result)

    def add_phone_otp_verify_route(self):
        @self.router.post("/otp/phone/verify/", response_model=SAuthTokenResponse)
        async def verify_phone_otp(
            data: SPhoneOTPVerify,
            request: Request,
            response: Response,
        ) -> SAuthTokenResponse:
            """Верификация OTP по телефону и получение токенов."""
            await auth_rate_limiter.check(request)

            auth_method = PhoneOTPAuthType(request=request, response=response)
            token = await auth_method.authenticate_user(
                phone=data.phone,
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

            return _serialize_current_user(user)

    def add_delete_me_route(self):
        @self.router.delete("/me/")
        async def delete_me(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Полностью удалить аккаунт текущего пользователя.

            Жёсткое удаление: строка пользователя и все связанные данные
            (анкеты, фото, отклики, подписки, уведомления и т.д.) удаляются
            каскадом на уровне БД. Email, телефон и Telegram освобождаются,
            поэтому с этими же данными можно зарегистрироваться заново.
            """
            from postgres.database import async_session_maker

            user_id = int(authorized.id)
            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                await session.execute(sa_delete(User).where(User.id == user_id))
                await session.commit()

            return {"ok": True, "message": "Аккаунт удалён"}

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

                from users.exceptions import UserException
                from users.services.authentication.types.email_auth import (
                    find_user_by_phone,
                    find_user_by_telegram,
                )

                if data.first_name is not None:
                    user.first_name = data.first_name
                if data.last_name is not None:
                    user.last_name = data.last_name
                if data.phone_number is not None:
                    if await find_user_by_phone(session, data.phone_number, exclude_id=user.id):
                        raise UserException.get_phone_already_exist_exc(phone=data.phone_number)
                    user.phone_number = data.phone_number
                if data.email is not None:
                    new_email = (data.email or "").strip().lower()
                    if new_email and new_email != (user.email or "").strip().lower():
                        existing = await session.execute(
                            select(User).where(
                                func.lower(User.email) == new_email,
                                User.is_deleted == False,  # noqa: E712
                                User.id != user.id,
                            )
                        )
                        if existing.scalars().first():
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Этот email уже используется другим аккаунтом",
                            )
                        user.email = new_email
                if data.middle_name is not None:
                    user.middle_name = data.middle_name
                if data.telegram_nick is not None:
                    if await find_user_by_telegram(session, data.telegram_nick, exclude_id=user.id):
                        raise UserException.get_tg_username_already_exist_exc(tg_username=data.telegram_nick)
                    user.telegram_nick = data.telegram_nick
                if data.vk_nick is not None:
                    user.vk_nick = data.vk_nick
                if data.max_nick is not None:
                    user.max_nick = data.max_nick
                if data.casting_notification_channel is not None:
                    available_channels = _get_available_casting_notification_channels(user)
                    if data.casting_notification_channel not in available_channels:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Selected notification channel is not available for this account",
                        )
                    user.casting_notification_channel = data.casting_notification_channel

                session.add(user)
                await session.commit()

            return _serialize_current_user(user)

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

            return _serialize_current_user(user)

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
        from sqlalchemy import text
        from postgres.database import async_engine

        @self.router.post("/init-owner/")
        async def init_owner(email: str, authorized: JWT = Depends(admin_authorized)):
            """Promote user to owner (SuperAdmin). Owner-only recovery endpoint."""
            if authorized.role not in ['owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")
            async with async_engine.connect() as conn:
                await conn.execute(text("COMMIT"))
                try:
                    await conn.execute(
                        text("ALTER TYPE modelroles ADD VALUE IF NOT EXISTS 'owner'")
                    )
                except Exception:
                    pass

                await conn.execute(text("BEGIN"))
                result = await conn.execute(
                    text("UPDATE users SET role = 'owner' WHERE email = :email RETURNING id"),
                    {"email": email}
                )
                row = result.scalar_one_or_none()
                if not row:
                    await conn.execute(text("ROLLBACK"))
                    raise HTTPException(status_code=404, detail="User not found")
                await conn.execute(text("COMMIT"))
            return {"message": f"User {email} promoted to owner", "user_id": row}
