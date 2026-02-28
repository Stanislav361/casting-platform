from abc import ABC, abstractmethod
from users.services.authentication.types.interface import AuthType
from users.models import User
from fastapi import Request, Response
from users.services.auth_token.service import TokenService
from users.services.auth_token.types.jwt import JWT

class AuthTypeFactory(ABC):
    def __init__(self, request: Request, response: Response):
        self.request = request
        self.response = response

    async def authenticate_user(self, *args, **kwargs) -> JWT:
        auth_type = self.get_authentication_type()
        token = await auth_type.authenticate_user(*args, **kwargs)
        return token

    async def refresh_access_token(self, *args, **kwargs) -> JWT:
        auth_type = self.get_authentication_type()
        token = await auth_type.refresh_access_token(*args, **kwargs)
        return token

    @abstractmethod
    def get_authentication_type(self) -> AuthType:
        pass

