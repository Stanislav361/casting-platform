from users.services.authorization.types.interface import AuthType
from users.services.auth_token.types.jwt import JWT
from users.enums import *
from users.services.authorization.exceptions import UserForbidden

class AdminAuthType(AuthType):
    target_role = Roles.administrator
    async def _check_role(self, user_token: JWT) -> Roles:
        user_role = Roles(user_token.role)
        if not user_role >= self.target_role:
            raise UserForbidden
        return user_role

    async def authorize(self, user_token: JWT, ):
        await self._check_role(user_token)
