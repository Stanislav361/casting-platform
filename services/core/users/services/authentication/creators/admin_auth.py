from users.services.authentication.creators.factory import AuthTypeFactory
from users.services.authentication.types.admin_auth import AdminTgAuthType

class TgAuthMethod(AuthTypeFactory):
    def get_authentication_type(self, ) -> AdminTgAuthType:
        return AdminTgAuthType(request=self.request, response=self.response)