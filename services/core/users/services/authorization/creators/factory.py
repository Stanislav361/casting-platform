from abc import ABC, abstractmethod
from users.services.authorization.types.interface import AuthType
from fastapi import Request, Response
from users.services.auth_token.service import TokenService
from users.services.auth_token.types.jwt import JWT

class AuthTypeFactory(ABC):
    def __init__(self, request: Request, ):
        self.request = request

    async def authorize(self, ) -> JWT:
        user_token = TokenService.validate_access_token(self.request)
        auth_type = self.get_authorization_type()
        await auth_type.authorize(user_token=user_token)
        return user_token

    @abstractmethod
    def get_authorization_type(self) -> AuthType:
        pass
