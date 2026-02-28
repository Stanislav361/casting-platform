import hmac
import hashlib
from urllib.parse import parse_qsl
from config import settings, tma_auth_flags
from fastapi import HTTPException, status

from postgres.database import transaction
from users.models import User
from users.repositories.types.tma import TmaUserRepository
from users.schemas.auth import SUserData, SUserDataAfterAuth
from users.services.auth_token.types.jwt import JWT
from users.services.authentication.types.interface import AuthType
import json
from users.exceptions import UserException
from users.services.authentication.exceptions import AuthenticationFailed
from users.services.auth_token.service import TokenService
from profiles.services.tma_user.service import TmaProfileService
from users.schemas.auth import STmaAuthData


class TmaAuthType(AuthType):

    @staticmethod
    def _validate_init_data(init_data: str, ) -> bool:
        data = dict(parse_qsl(init_data))
        check_string = '\n'.join(
            f"{key}={value}" for key, value in sorted(data.items()) if key != 'hash'
        )
        secret_key = hmac.new("WebAppData".encode(), settings.TG_BOT_TOKEN.encode(), hashlib.sha256).digest()
        signature = hmac.new(secret_key, check_string.encode(), hashlib.sha256).hexdigest()
        return data.get('hash') == signature

    def _verify_telegram_auth_data(self, init_str: str) -> SUserDataAfterAuth:
        if not init_str.startswith("tma "):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Authorization format")
        if not self._validate_init_data(init_str[4:],):
            raise UserException.UserAuthenticationError
        return SUserDataAfterAuth(**json.loads(dict(parse_qsl(init_str[4:])).get('user')))

    async def _fake_authenticate(self, session) -> JWT:
        user_data = SUserDataAfterAuth(
            id=987654321,
            username='dev_user',
            first_name='Dev',
            last_name='User',
            photo_url=None,
        )
        user = await TmaUserRepository.add_or_get(session=session, user_data=user_data)
        profile_id = await TmaProfileService.create_empty_profile_or_get(session=session, user_id=user.id)
        return await self._get_tokens(user=user, profile_id=profile_id)

    async def _get_tokens(self, user: User, profile_id: int) -> JWT:
        TokenService.set_refresh_token(
            response=self.response,
            user_id=str(user.id),
            role=user.role,
            profile_id=str(profile_id),
            container=settings.REFRESH_TMA_TOKEN_CONTAINER_NAME,
        )
        token = TokenService.generate_access_token(
            user_id=str(user.id), profile_id=str(profile_id), role=user.role
        )
        return token

    @transaction
    async def authenticate_user(self, session, auth_data: STmaAuthData) -> JWT:

        try:
            if settings.MODE in ['LOCAL', 'DEV'] and not await TmaUserRepository.auth_predicate():
                return await self._fake_authenticate(session=session)
            user_data: SUserDataAfterAuth = self._verify_telegram_auth_data(init_str=auth_data.init_str)
            user = await TmaUserRepository.add_or_get(session=session, user_data=user_data)
            profile_id = await TmaProfileService.create_empty_profile_or_get(session=session, user_id=user.id)
            return await self._get_tokens(user=user, profile_id=profile_id)
        except KeyError:
            raise AuthenticationFailed().API_ERR

    async def refresh_access_token(self,) -> JWT:
        return TokenService.refresh_access_token(
            request=self.request,
            container=settings.REFRESH_TMA_TOKEN_CONTAINER_NAME
        )
