from users.services.authorization.creators.factory import  AuthTypeFactory
from users.services.authorization.types.user import UserAuthType

class UserAuthMethod(AuthTypeFactory):
    def get_authorization_type(self, ) -> UserAuthType:
        return UserAuthType(request=self.request, )