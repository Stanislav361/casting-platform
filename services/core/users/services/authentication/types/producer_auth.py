from postgres.database import transaction
from users.services.auth_token.types.jwt import JWT
from users.services.authentication.types.interface import AuthType
from users.schemas.auth import STmaAuthData


class ProducerAuthType(AuthType):
    @transaction
    async def authenticate_user(self, session, auth_data: STmaAuthData) -> JWT:
        pass

    async def refresh_access_token(self,) -> JWT:
        pass