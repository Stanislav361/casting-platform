from users.models import User
from users.services.authentication.types.interface import AuthType
from users.schemas.auth import SUpdateAdminDataAfterAuth, SAdminAuthData, SJWTData
from users.services.auth_token.types.jwt import JWT
from users.services.auth_token.service import TokenService
from users.repositories.types.admin import AdminUserRepository
from config import settings, admin_auth_flags
import hashlib
import hmac
import time
from users.enums import ModelRoles
from users.services.authentication.exceptions import AuthenticationFailed
from profiles.services.tma_user.service import TmaProfileService
from postgres.database import transaction


class AdminTgAuthType(AuthType):

    async def _get_tokens(self, user: User, profile_id: int) -> JWT:
        TokenService.set_refresh_token(
            response=self.response,
            user_id=str(user.id),
            role=user.role,
            profile_id=str(profile_id),
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
        )
        token = TokenService.generate_access_token(
            user_id=str(user.id), profile_id=str(profile_id), role=user.role
        )
        return token

    @staticmethod
    def _verify_telegram_auth_data(auth_data: SAdminAuthData) -> None:
        from log.base import logger

        auth_data_dump = auth_data.model_dump() # noqa

        # logger.debug(msg=f'auth data dump {auth_data_dump}')

        received_signature = auth_data_dump.get('hash')

        # logger.debug(msg=f'received signature {received_signature}')

        check_string = "\n".join(
            [f"{key}={value}" for key, value in sorted(auth_data_dump.items()) if key != 'hash' and value is not None]
        )

        # logger.debug(msg=f'check string {check_string}')

        computed_signature = hmac.new(
            hashlib.sha256(settings.TG_BOT_TOKEN.encode()).digest(),
            msg=check_string.encode(), # noqa
            digestmod=hashlib.sha256
        ).hexdigest()

        # logger.debug(msg=f'computed signature {computed_signature}')

        is_time =  time.time() - int(auth_data_dump['auth_date']) < 86400

        # logger.debug(msg=f"auth_date {auth_data_dump['auth_date']}")

        # logger.debug(msg=f'is_time {is_time}')

        is_signature = computed_signature == received_signature

        # logger.debug(msg=f'is_signature {is_signature}')

        is_verified = all([
            is_time,
            is_signature,
        ])

        # logger.debug(msg=f'is_verified {is_verified}')

        if not is_verified:
            raise AuthenticationFailed().API_ERR

    @staticmethod
    async def _actualize_and_migrate_profile(user: User, auth_data: SAdminAuthData) -> int:
        await AdminUserRepository.update_user_info(  # Добиваемся чтобы при каждой аутентификации данные админа из его tg актуализировались
            user_id=user.id,
            update_data=SUpdateAdminDataAfterAuth(**auth_data.model_dump()),
        )

        profile_id = await TmaProfileService.create_empty_profile_or_get(user_id=user.id)  # обратная совместимость для админа в tma

        return profile_id

    async def _fake_authenticate(
            self,
    ) -> JWT:

        user = await AdminUserRepository.get_user_with_target_role(
            telegram_username='dev_admin', roles=[ModelRoles.administrator, ]
        )
        profile_id = await TmaProfileService.create_empty_profile_or_get(user_id=user.id)
        return await self._get_tokens(user=user, profile_id=profile_id)

    @transaction
    async def authenticate_user(self, session, auth_data: SAdminAuthData) -> JWT:
        if settings.MODE in ["LOCAL", "DEV"] and not await AdminUserRepository.auth_predicate():
            return await self._fake_authenticate()
        self._verify_telegram_auth_data(auth_data=auth_data)
        target_roles = [ModelRoles.administrator, ]
        user = await AdminUserRepository.get_user_with_target_role(
            telegram_username=auth_data.username,
            roles=target_roles
        )
        if user:
            profile_id = await self._actualize_and_migrate_profile(user=user, auth_data=auth_data)
            return await self._get_tokens(user=user, profile_id=profile_id)
        raise AuthenticationFailed().API_ERR

    async def refresh_access_token(self,) -> JWT:
        return TokenService.refresh_access_token(
            request=self.request,
            container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME
        )
