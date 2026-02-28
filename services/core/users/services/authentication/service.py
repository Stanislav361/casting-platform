from users.services.authentication.creators.factory import AuthTypeFactory

class AuthenticateUserService:

    def __init__(self, authenticate_method: AuthTypeFactory):
        self.authenticate_method = authenticate_method

    async def authenticate_user(self, *args, **kwargs):
        return await self.authenticate_method.authenticate_user(*args, **kwargs)

    async def refresh_access_token(self, *args, **kwargs):
        return await self.authenticate_method.refresh_access_token(*args, **kwargs)

