from users.services.authentication.creators.factory import AuthTypeFactory
from users.services.authentication.types.tma_auth import TmaAuthType


class TMAAuthMethod(AuthTypeFactory):
    def get_authentication_type(self, ) -> TmaAuthType:
        return TmaAuthType(request=self.request, response=self.response)