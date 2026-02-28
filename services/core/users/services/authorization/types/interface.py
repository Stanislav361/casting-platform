from fastapi import Request
from abc import ABC, abstractmethod
from users.services.auth_token.types.jwt import JWT


class AuthType(ABC):

    def __init__(self, request: Request):
        self.request = request

    @abstractmethod
    async def authorize(self, user_token: JWT, ):
        pass
