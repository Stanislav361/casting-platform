"""
Email/Password + OTP аутентификация.

Провайдеры:
- Email/Password
- OTP (Email/SMS)
- Telegram (опционально, как связка)
"""
import hashlib
import hmac
import re
import secrets
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select, update, insert, func, or_

from postgres.database import transaction
from users.models import User, OTPCode
from users.services.authentication.types.interface import AuthType
from users.services.auth_token.types.jwt import JWT
from users.services.auth_token.service import TokenService
from users.services.authentication.exceptions import AuthenticationFailed
from users.enums import ModelRoles
from config import settings
from shared.contacts import telegram_key
from shared.services.sms.service import SMSDeliveryService, SMSDeliveryError


def normalize_phone_key(phone: Optional[str]) -> Optional[str]:
    """Канонический ключ телефона для сравнения (последние 10 цифр).

    Убирает любые разделители/скобки/пробелы и код страны, поэтому
    "+7 (995) 557-00-20", "89955570020" и "+79955570020" дают один ключ.
    """
    if not phone:
        return None
    digits = re.sub(r'\D', '', phone)
    if not digits:
        return None
    return digits[-10:] if len(digits) >= 10 else digits


def normalize_email(value: Optional[str]) -> Optional[str]:
    """Канонический ключ email (без пробелов, в нижнем регистре)."""
    if not value:
        return None
    return value.strip().lower() or None


_PHONE_DIGITS = func.regexp_replace(User.phone_number, r'\D', '', 'g')


def _telegram_key_sql(column):
    """Тот же ключ, что и `telegram_key`, но считанный на стороне БД.

    Раньше здесь снимался только «@», поэтому сохранённое «t.me/nick» никогда
    не совпадало с введённым «@nick»: один и тот же человек выглядел как два
    разных контакта, а в перенесённой базе ников в виде ссылок много.
    """
    stripped = func.regexp_replace(
        func.lower(column),
        r'^(https?://)?(t\.me/|telegram\.me/)?@?',
        '',
    )
    return func.rtrim(stripped, '/')


async def find_user_by_phone(session, phone: Optional[str], exclude_id: Optional[int] = None):
    """Активный пользователь с таким же номером телефона (по каноническому ключу)."""
    key = normalize_phone_key(phone)
    if not key:
        return None
    stmt = (
        select(User)
        .where(
            User.is_deleted == False,  # noqa: E712
            User.phone_number.isnot(None),
            func.right(_PHONE_DIGITS, 10) == key,
        )
        .order_by(User.is_active.desc(), User.id.asc())
    )
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    return (await session.execute(stmt)).scalars().first()


async def find_user_by_email(session, email: Optional[str], exclude_id: Optional[int] = None):
    """Пользователь с таким email без учёта регистра и лишних пробелов.

    Перенесённая база содержит адреса в разном регистре ("Ivan@Mail.ru"), а
    человек вводит почту как ему удобно. Точное сравнение отправило бы его в
    новый пустой аккаунт вместо своей анкеты, поэтому сравниваем по ключу.
    """
    key = normalize_email(email)
    if not key:
        return None
    stmt = (
        select(User)
        .where(
            User.is_deleted == False,  # noqa: E712
            User.email.isnot(None),
            func.lower(func.btrim(User.email)) == key,
        )
        .order_by(User.is_active.desc(), User.id.asc())
    )
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    return (await session.execute(stmt)).scalars().first()


async def find_importable_user_by_telegram(session, telegram_value: Optional[str]):
    """Нетронутая запись из перенесённой базы с таким Telegram-ником.

    По нику мы подхватываем анкеты из перенесённой базы: числового telegram_id
    там нет, и без этой связки человек получил бы новый пустой аккаунт вместо
    своей анкеты.

    Но ник — свободно заполняемое контактное поле, один и тот же могут указать
    несколько людей, поэтому пускать по нику в любой найденный аккаунт нельзя.
    Привязываем только запись, в которую никто ни разу не входил (нет пароля,
    не привязан Telegram, аккаунт не активирован), и только если такая запись
    ровно одна. Во всех остальных случаях человек просто получит свой новый
    аккаунт — это всегда безопаснее, чем впустить его в чужой профиль.
    """
    key = telegram_key(telegram_value)
    if not key:
        return None
    stmt = (
        select(User)
        .where(
            User.is_deleted == False,  # noqa: E712
            User.is_active == False,  # noqa: E712
            User.telegram_id.is_(None),
            User.password_hash.is_(None),
            or_(
                _telegram_key_sql(User.telegram_nick) == key,
                _telegram_key_sql(User.telegram_username) == key,
            ),
        )
        .order_by(User.id.asc())
        .limit(2)
    )
    candidates = (await session.execute(stmt)).scalars().all()
    return candidates[0] if len(candidates) == 1 else None


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
        user = await find_user_by_email(session, email)

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
        return await TokenService.refresh_access_token(
            request=self.request,
            response=self.response,
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )


class EmailOTPAuthType(AuthType):
    """
    Аутентификация через OTP (Email).
    """

    @transaction
    async def send_otp(self, session, email: str) -> dict:
        """Отправка OTP на email."""
        # Канонический ключ используем и для поиска, и для самого кода: иначе
        # регистр, введённый человеком, не совпал бы с адресом в базе.
        email = normalize_email(email) or email
        user = await find_user_by_email(session, email)

        is_new_user = user is None
        if not user:
            user = User(
                email=email,
                role=ModelRoles.user,
                is_active=True,
                # У человека есть почта — по умолчанию шлём уведомления на email
                # (надёжнее push на Android), колокольчик в приложении тоже есть.
                casting_notification_channel='email',
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
        email = normalize_email(email) or email
        is_valid = await OTPService.verify_otp(
            session=session,
            destination=email,
            code=code,
        )
        if not is_valid:
            raise AuthenticationFailed(detail={"message": "Invalid or expired OTP code"}).API_ERR

        user = await find_user_by_email(session, email)

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
        return await TokenService.refresh_access_token(
            request=self.request,
            response=self.response,
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )


class PhoneOTPAuthType(AuthType):
    """
    Аутентификация через OTP (SMS на телефон).
    """

    @transaction
    async def send_otp(self, session, phone: str) -> dict:
        """Отправка OTP на телефон."""
        # Ищем по каноническому ключу, чтобы не создавать дубль аккаунта,
        # если номер уже привязан в другом формате (напр. при email-регистрации).
        user = await find_user_by_phone(session, phone)

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

        user = await find_user_by_phone(session, phone)

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
        return await TokenService.refresh_access_token(
            request=self.request,
            response=self.response,
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
        from users.exceptions import UserException

        email = normalize_email(email) or email
        existing = await find_user_by_email(session, email)

        exclude_id = existing.id if existing else None

        # Телефон уникален: по нему входят по коду, поэтому один номер не может
        # вести в два аккаунта. Ник Telegram так не проверяем — это просто
        # контакт для связи (вход идёт по подписи Telegram, а не по нику), и в
        # перенесённой базе полно дубликатов одного и того же человека, из-за
        # которых люди не могли зарегистрироваться под своим же ником.
        phone_owner = await find_user_by_phone(session, phone_number, exclude_id=exclude_id)
        if phone_owner is not None:
            raise UserException.get_phone_already_exist_exc(phone=phone_number)

        if existing:
            if not existing.is_active:
                existing.password_hash = PasswordHasher.hash_password(password)
                # Заполняем только пустые поля: у аккаунтов из перенесённой базы
                # уже есть имя, телефон и Telegram, и их нельзя затирать тем,
                # что человек не стал вводить в форме регистрации.
                for field, value in (
                    ('first_name', first_name),
                    ('last_name', last_name),
                    ('middle_name', middle_name),
                    ('phone_number', phone_number),
                    ('telegram_nick', telegram_nick),
                    ('vk_nick', vk_nick),
                    ('max_nick', max_nick),
                ):
                    if value and not getattr(existing, field, None):
                        setattr(existing, field, value)
                session.add(existing)
                await session.flush()
                return existing
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
            casting_notification_channel='email',
        )
        session.add(user)
        await session.flush()
        return user


