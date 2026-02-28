from fastapi import HTTPException, status
from typing import Optional

class AuthenticationFailed(Exception):
    def __init__(self, detail: Optional[dict] = None):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail
        )


class ExpiredAccessToken(AuthenticationFailed):
    def __init__(self):
        super().__init__({
            'event': 'expired',
            'type': 'access token',
        })


class ExpiredRefreshToken(AuthenticationFailed):
    def __init__(self):
        super().__init__({
            'event': 'expired',
            'type': 'refresh token',
        })
