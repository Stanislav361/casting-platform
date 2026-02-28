from users.services.auth_token.types.jwt import JWT
from users.services.authentication.exceptions import AuthenticationFailed, ExpiredAccessToken
from users.exceptions import UserException
from jose import jwt, JWTError
from config import settings
from datetime import datetime, timedelta, timezone
from users.schemas.auth import SJWTData
from typing import Union, Optional
from users.services.auth_token.services.interface import TokenInterface


class JWTService(TokenInterface):

    @staticmethod
    def verify(token: str) -> JWT:
        try:
            if not token.startswith(JWT.TYPE):
                raise AuthenticationFailed().API_ERR
            token = token[len(JWT.TYPE) + 1:]
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                settings.ALGORITHM,
            )
            JWTService._check_expired_token(expire=payload.get('expire'))
            return JWT(jwt_data=SJWTData(**payload), token=token)
        except JWTError:
            raise AuthenticationFailed().API_ERR
        except ExpiredAccessToken:
            raise

    @staticmethod
    def _check_expired_token(expire: Union[int, float]) -> None:
        if not expire > datetime.now(timezone.utc).timestamp():
            raise ExpiredAccessToken


    @staticmethod
    def generate(user_id: str, profile_id: str, role: str) -> JWT:
        expire = (datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)).timestamp()
        data = SJWTData(id=user_id, profile_id=profile_id, role=role, expire=expire)
        to_encode = data.model_dump()
        encode_jwt = jwt.encode(
            to_encode,
            settings.SECRET_KEY,
            settings.ALGORITHM,
        )
        return JWT(jwt_data=data, token=encode_jwt)