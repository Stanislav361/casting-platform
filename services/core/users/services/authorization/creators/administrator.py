from users.services.authorization.creators.factory import  AuthTypeFactory
from users.services.authorization.types.administrator import AdminAuthType


class AdminAuthMethod(AuthTypeFactory):
    def get_authorization_type(self, ) -> AdminAuthType:
        return AdminAuthType(request=self.request, )