from users.schemas.auth import SRefreshTokenData

class RefreshToken:
    TYPE = 'refresh_token'

    def __init__(self, refresh_data: SRefreshTokenData, token: str):
        self._data = refresh_data
        self._token = token

    @property
    def data(self) -> SRefreshTokenData:
        return self._data

    @property
    def token(self) -> str:
        return self._token

    def __dir__(self):
        base_attrs = set(super().__dir__())
        data_attrs = {'expire', 'token', 'data', }
        return list(base_attrs | data_attrs)

    def __str__(self):
        return self.token

    def __repr__(self):
        return self.token

    def __getattribute__(self, item):
        try:
            return object.__getattribute__(self, item)
        except AttributeError:
            refresh_data = object.__getattribute__(self, '_data')
            return getattr(refresh_data, item)

    def __getattr__(self, item):
        raise AttributeError(f"Attribute '{item}' not found in refresh_token.")