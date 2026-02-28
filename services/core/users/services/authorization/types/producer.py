from users.services.authorization.types.interface import AuthType
from users.services.auth_token.types.jwt import JWT
from users.enums import *

class ProducerAuthType(AuthType):
    target_role = Roles.producer

    async def authorize(self, user_token: JWT, ):
        pass

