from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from config import settings
from users.schemas.auth import SRefreshTokenData
from users.services.auth_token.types.refresh import RefreshToken
from typing import Union
from users.services.authentication.exceptions import  AuthenticationFailed, ExpiredRefreshToken
from users.services.auth_token.services.interface import TokenInterface

class RefreshTokenService(TokenInterface):

    @staticmethod
    def verify(token: str) -> RefreshToken:
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                settings.ALGORITHM,
            )
            RefreshTokenService._check_expired_token(expire=payload.get('expire'))
            return RefreshToken(refresh_data=SRefreshTokenData(**payload), token=token)
        except JWTError:
            raise AuthenticationFailed().API_ERR
        except ExpiredRefreshToken:
            raise

    @staticmethod
    def _check_expired_token(expire: Union[int, float]) -> None:
        if not expire > datetime.now(timezone.utc).timestamp():
            raise ExpiredRefreshToken

    @staticmethod
    def generate(user_id: str, role: str, profile_id: str) -> RefreshToken:
        expire = (datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)).timestamp()
        data = SRefreshTokenData(id=user_id, profile_id=profile_id, role=role, expire=expire, )
        to_encode = data.model_dump()
        encode_token = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            settings.ALGORITHM,
        )
        return RefreshToken(
            token=encode_token,
            refresh_data=data
        )
