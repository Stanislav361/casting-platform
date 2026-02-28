from abc import ABC, abstractmethod
from users.models import User
from users.services.auth_token.types.jwt import JWT
from fastapi import Request
from typing import Any
from fastapi import Request, Response
from users.repositories.base import BaseUserRepository

class AuthType(ABC):
    def __init__(self, request: Request, response: Response,):
        self.request = request
        self.response = response

    @abstractmethod
    async def authenticate_user(self, *args, **kwargs) -> JWT:
        pass

    @abstractmethod
    async def refresh_access_token(self, *args, **kwargs) -> JWT:
        pass
