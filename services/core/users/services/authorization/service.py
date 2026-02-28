from jose.exceptions import JWTError
from users.services.authorization.exceptions import UserForbidden
from users.services.authorization.creators.factory import AuthTypeFactory
from users.services.auth_token.types.jwt import JWT

class AuthorizationService:

    def __init__(self, authorization_method: AuthTypeFactory):
        self.authorization_method = authorization_method

    async def authorize(self, ) -> JWT:
        try:
            return await self.authorization_method.authorize()
        except UserForbidden as err:
            raise err.API_ERR
