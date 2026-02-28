from abc import ABC, abstractmethod
from typing import Any, Union
from users.services.auth_token.types.jwt import JWT
from users.services.auth_token.types.refresh import RefreshToken


class TokenInterface(ABC):

    @staticmethod
    @abstractmethod
    def verify(token: str) -> Union[JWT, RefreshToken]:
        pass

    @staticmethod
    @abstractmethod
    def _check_expired_token(expire: Union[int, float]) -> None:
        pass

    @staticmethod
    @abstractmethod
    def generate(user_id: str, role: str, profile_id: str) -> Union[JWT, RefreshToken]:
        pass