"""
Email/Password + OTP аутентификация.

Провайдеры:
- Email/Password
- OTP (Email/SMS)
- Telegram (опционально, как связка)
"""
import hashlib
import hmac
import secrets
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, update, insert

from postgres.database import transaction
from users.models import User, OTPCode
from users.services.authentication.types.interface import AuthType
from users.services.auth_token.types.jwt import JWT
from users.services.auth_token.service import TokenService
from users.services.authentication.exceptions import AuthenticationFailed
from users.enums import ModelRoles
from config import settings
from shared.services.sms.service import SMSDeliveryService, SMSDeliveryError


class PasswordHasher:
    """Хеширование паролей с PBKDF2-SHA256."""

    @staticmethod
    def hash_password(password: str) -> str:
        salt = secrets.token_hex(16)
        pwd_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100_000,
        )
        return f"{salt}:{pwd_hash.hex()}"

    @staticmethod
    def verify_password(password: str, stored_hash: str) -> bool:
        try:
            salt, pwd_hash = stored_hash.split(':')
            computed = hashlib.pbkdf2_hmac(
                'sha256',
                password.encode('utf-8'),
                salt.encode('utf-8'),
                100_000,
            )
            return hmac.compare_digest(computed.hex(), pwd_hash)
        except (ValueError, AttributeError):
            return False


class OTPService:
    """Генерация и валидация OTP-кодов."""

    OTP_LENGTH = 6
    OTP_EXPIRY_MINUTES = 10
    MAX_ATTEMPTS = 5

    @classmethod
    def generate_code(cls) -> str:
        return ''.join(random.choices(string.digits, k=cls.OTP_LENGTH))

    @classmethod
    @transaction
    async def create_otp(
        cls,
        session,
        destination: str,
        destination_type: str,
        user_id: Optional[int] = None,
    ) -> OTPCode:
        """Создаёт новый OTP-код."""
        code = cls.generate_code()
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=cls.OTP_EXPIRY_MINUTES)

        otp = OTPCode(
            user_id=user_id,
            destination=destination,
            destination_type=destination_type,
            code=code,
            expires_at=expires_at,
        )
        session.add(otp)
        await session.flush()
        return otp

    @classmethod
    @transaction
    async def verify_otp(
        cls,
        session,
        destination: str,
        code: str,
    ) -> bool:
        """Проверяет OTP-код."""
        stmt = (
            select(OTPCode)
            .filter_by(destination=destination, is_used=False)
            .filter(OTPCode.expires_at > datetime.now(timezone.utc))
            .order_by(OTPCode.created_at.desc())
            .limit(1)
        )
        result = await session.execute(stmt)
        otp = result.scalar_one_or_none()

        if not otp:
            return False

        # Инкрементируем попытки
        otp.attempts += 1

        if otp.attempts > cls.MAX_ATTEMPTS:
            otp.is_used = True  # Блокируем после макс. попыток
            return False

        if otp.code != code:
            return False

        # OTP валиден — помечаем как использованный
        otp.is_used = True
        return True


class EmailPasswordAuthType(AuthType):
    """
    Аутентификация через Email/Password.
    """

    @transaction
    async def authenticate_user(self, session, email: str, password: str) -> JWT:
        """Аутентификация по email и паролю."""
        stmt = (
            select(User)
            .filter_by(email=email, is_deleted=False)
        )
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user or not user.password_hash:
            raise AuthenticationFailed().API_ERR

        if not PasswordHasher.verify_password(password, user.password_hash):
            raise AuthenticationFailed().API_ERR

        if not user.is_active:
            raise AuthenticationFailed(detail={"message": "Account is deactivated"}).API_ERR

        # Получаем profile_id (первый профиль по умолчанию или 0)
        profile_id = 0
        if user.profiles:
            active_profiles = [p for p in user.profiles if p.is_active and not p.is_deleted]
            if active_profiles:
                profile_id = active_profiles[0].id

        return await self._get_tokens(user=user, profile_id=profile_id)

    async def _get_tokens(self, user: User, profile_id: int) -> JWT:
        TokenService.set_refresh_token(
            response=self.response,
            user_id=str(user.id),
            role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            profile_id=str(profile_id),
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )
        token = TokenService.generate_access_token(
            user_id=str(user.id),
            profile_id=str(profile_id),
            role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        )
        return token

    async def refresh_access_token(self) -> JWT:
        return TokenService.refresh_access_token(
            request=self.request,
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )


class EmailOTPAuthType(AuthType):
    """
    Аутентификация через OTP (Email).
    """

    @transaction
    async def send_otp(self, session, email: str) -> dict:
        """Отправка OTP на email."""
        # Проверяем/создаём пользователя
        stmt = select(User).filter_by(email=email, is_deleted=False)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            # Создаём нового пользователя при первом входе через OTP
            user = User(
                email=email,
                role=ModelRoles.user,
                is_active=True,
            )
            session.add(user)
            await session.flush()

        otp = await OTPService.create_otp(
            session=session,
            destination=email,
            destination_type='email',
            user_id=user.id,
        )

        # TODO: Интеграция с email-сервисом для отправки
        # В DEV/LOCAL режиме возвращаем код в ответе
        result = {"message": "OTP sent", "destination": email}
        if settings.MODE in ['LOCAL', 'DEV']:
            result["code"] = otp.code  # Только для разработки!

        return result

    @transaction
    async def authenticate_user(self, session, email: str, code: str) -> JWT:
        """Верификация OTP и выдача токенов."""
        is_valid = await OTPService.verify_otp(
            session=session,
            destination=email,
            code=code,
        )
        if not is_valid:
            raise AuthenticationFailed(detail={"message": "Invalid or expired OTP code"}).API_ERR

        stmt = select(User).filter_by(email=email, is_deleted=False)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise AuthenticationFailed().API_ERR

        profile_id = 0
        if user.profiles:
            active_profiles = [p for p in user.profiles if p.is_active and not p.is_deleted]
            if active_profiles:
                profile_id = active_profiles[0].id

        return await self._get_tokens(user=user, profile_id=profile_id)

    async def _get_tokens(self, user: User, profile_id: int) -> JWT:
        TokenService.set_refresh_token(
            response=self.response,
            user_id=str(user.id),
            role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            profile_id=str(profile_id),
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )
        token = TokenService.generate_access_token(
            user_id=str(user.id),
            profile_id=str(profile_id),
            role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        )
        return token

    async def refresh_access_token(self) -> JWT:
        return TokenService.refresh_access_token(
            request=self.request,
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )


class PhoneOTPAuthType(AuthType):
    """
    Аутентификация через OTP (SMS на телефон).
    """

    @transaction
    async def send_otp(self, session, phone: str) -> dict:
        """Отправка OTP на телефон."""
        stmt = select(User).filter_by(phone_number=phone, is_deleted=False)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            user = User(
                phone_number=phone,
                role=ModelRoles.user,
                is_active=True,
            )
            session.add(user)
            await session.flush()

        otp = await OTPService.create_otp(
            session=session,
            destination=phone,
            destination_type='sms',
            user_id=user.id,
        )

        if settings.MODE not in ['LOCAL', 'DEV']:
            if not SMSDeliveryService.is_configured():
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail={"message": "SMS provider is not configured"},
                )
            try:
                await SMSDeliveryService.send_otp_code(phone=phone, code=otp.code)
            except SMSDeliveryError as exc:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail={"message": f"SMS sending failed: {exc}"},
                ) from exc

        result = {"message": "OTP sent", "destination": phone}
        if settings.MODE in ['LOCAL', 'DEV']:
            result["code"] = otp.code

        return result

    @transaction
    async def authenticate_user(self, session, phone: str, code: str) -> JWT:
        """Верификация OTP по телефону и выдача токенов."""
        is_valid = await OTPService.verify_otp(
            session=session,
            destination=phone,
            code=code,
        )
        if not is_valid:
            raise AuthenticationFailed(detail={"message": "Invalid or expired OTP code"}).API_ERR

        stmt = select(User).filter_by(phone_number=phone, is_deleted=False)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            raise AuthenticationFailed().API_ERR

        profile_id = 0
        if user.profiles:
            active_profiles = [p for p in user.profiles if p.is_active and not p.is_deleted]
            if active_profiles:
                profile_id = active_profiles[0].id

        return await self._get_tokens(user=user, profile_id=profile_id)

    async def _get_tokens(self, user: User, profile_id: int) -> JWT:
        TokenService.set_refresh_token(
            response=self.response,
            user_id=str(user.id),
            role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            profile_id=str(profile_id),
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )
        token = TokenService.generate_access_token(
            user_id=str(user.id),
            profile_id=str(profile_id),
            role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        )
        return token

    async def refresh_access_token(self) -> JWT:
        return TokenService.refresh_access_token(
            request=self.request,
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )


class UserRegistrationService:
    """Регистрация нового пользователя через Email/Password."""

    @classmethod
    @transaction
    async def register(
        cls,
        session,
        email: str,
        password: str,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        middle_name: Optional[str] = None,
        phone_number: Optional[str] = None,
        telegram_nick: Optional[str] = None,
        vk_nick: Optional[str] = None,
        max_nick: Optional[str] = None,
    ) -> User:
        """Регистрация по Email/Password."""
        stmt = select(User).filter_by(email=email)
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            from users.exceptions import UserException
            raise UserException.get_email_already_exist_exc(email=email)

        password_hash = PasswordHasher.hash_password(password)

        user = User(
            email=email,
            password_hash=password_hash,
            first_name=first_name,
            last_name=last_name,
            middle_name=middle_name,
            phone_number=phone_number,
            telegram_nick=telegram_nick,
            vk_nick=vk_nick,
            max_nick=max_nick,
            role=ModelRoles.user,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        return user


