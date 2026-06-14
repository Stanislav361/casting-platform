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
        destination_type: Optional[str] = None,
    ) -> bool:
        """Проверяет OTP-код."""
        now = datetime.now(timezone.utc)

        base_filters = [
            OTPCode.destination == destination,
            OTPCode.is_used == False,  # noqa: E712
            OTPCode.expires_at > now,
        ]
        if destination_type:
            base_filters.append(OTPCode.destination_type == destination_type)

        # Сначала ищем валидный неиспользованный код, совпадающий с введённым.
        # Это надёжнее, чем брать только последний код: при повторных
        # запросах кода может существовать несколько активных записей,
        # и пользователь мог ввести любой из показанных ему кодов.
        match_stmt = (
            select(OTPCode)
            .where(*base_filters, OTPCode.code == code)
            .order_by(OTPCode.created_at.desc())
            .limit(1)
        )
        otp = (await session.execute(match_stmt)).scalar_one_or_none()

        if otp:
            otp.is_used = True
            return True

        # Совпадения нет — фиксируем неудачную попытку на последнем коде
        # (для защиты от перебора).
        latest_stmt = (
            select(OTPCode)
            .where(*base_filters)
            .order_by(OTPCode.created_at.desc())
            .limit(1)
        )
        latest = (await session.execute(latest_stmt)).scalar_one_or_none()
        if latest:
            latest.attempts += 1
            if latest.attempts > cls.MAX_ATTEMPTS:
                latest.is_used = True

        return False


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
        stmt = select(User).filter_by(email=email, is_deleted=False)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        is_new_user = user is None
        if not user:
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

        from shared.services.email.service import EmailDeliveryService

        delivered = False
        if EmailDeliveryService.is_configured():
            try:
                await EmailDeliveryService.send_notification_email(
                    to_email=email,
                    subject="Код входа prostoprobuy",
                    message=f"Ваш код для входа: {otp.code}\n\nКод действует 10 минут.",
                )
                delivered = True
            except Exception:
                delivered = False

        if settings.MODE in ['LOCAL', 'DEV']:
            include_code = True
        elif not delivered and is_new_user:
            include_code = True
        else:
            include_code = False

        if not delivered and not include_code and settings.MODE not in ['LOCAL', 'DEV']:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "message": "Email-сервис временно недоступен. Войдите через Telegram, Яндекс или телефон.",
                },
            )

        result = {
            "message": "Код отправлен на email" if delivered else "Код сгенерирован (показан ниже)",
            "destination": email,
        }
        if include_code:
            result["code"] = otp.code

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

        # Успешный OTP на email подтверждает владение почтой — активируем
        # аккаунт, если он остался неактивным после незавершённой регистрации.
        if not user.is_active:
            user.is_active = True
            session.add(user)

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

        is_new_user = user is None
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

        delivered = False
        if SMSDeliveryService.is_configured():
            try:
                await SMSDeliveryService.send_otp_code(phone=phone, code=otp.code)
                delivered = True
            except SMSDeliveryError:
                delivered = False

        # Возвращаем код в ответе только если:
        # - DEV/LOCAL режим, ИЛИ
        # - SMS-провайдер не сконфигурирован И это новый пользователь
        #   (для существующих пользователей возвращать код небезопасно —
        #    был бы возможен захват чужого аккаунта).
        if settings.MODE in ['LOCAL', 'DEV']:
            include_code = True
        elif not delivered and is_new_user:
            include_code = True
        else:
            include_code = False

        # Если SMS не работает и пользователь существующий — возвращаем явную ошибку
        if not delivered and not include_code and settings.MODE not in ['LOCAL', 'DEV']:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "message": "SMS-сервис временно недоступен. Войдите через Telegram, Яндекс или Email.",
                },
            )

        result = {
            "message": "Код отправлен по SMS" if delivered else "Код сгенерирован (показан ниже)",
            "destination": phone,
        }
        if include_code:
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
            if not existing.is_active:
                existing.password_hash = PasswordHasher.hash_password(password)
                existing.first_name = first_name
                existing.last_name = last_name
                existing.middle_name = middle_name
                existing.phone_number = phone_number
                existing.telegram_nick = telegram_nick
                existing.vk_nick = vk_nick
                existing.max_nick = max_nick
                session.add(existing)
                await session.flush()
                return existing
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
            is_active=False,
        )
        session.add(user)
        await session.flush()
        return user


