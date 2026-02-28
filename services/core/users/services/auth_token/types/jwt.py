from users.schemas.auth import SJWTData


class JWT:
    TYPE = 'Bearer'
    def __init__(self, jwt_data: SJWTData, token: str):
        self._data = jwt_data
        self._token = token

    @property
    def bearer(self) -> str:
        return self.TYPE

    @property
    def data(self) -> SJWTData:
        return self._data

    @property
    def token(self) -> str:
        return f'{self._token}'


    def __dir__(self):
        base_attrs = set(super().__dir__())
        jwt_data_attrs = {'sub', 'role', 'expire', 'token', 'data', }
        return list(base_attrs | jwt_data_attrs)


    def __str__(self):
        return self.token

    def __repr__(self):
        return self.token

    def __getattribute__(self, item):
        try:
            return object.__getattribute__(self, item)
        except AttributeError:
            jwt_data = object.__getattribute__(self, '_data')
            return getattr(jwt_data, item)

    def __getattr__(self, item):
        raise AttributeError(f"Attribute '{item}' not found in JWT.")

