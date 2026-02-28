from fastapi import HTTPException, status
from typing import Optional

class AuthorizationFailed(Exception):

    def __init__(self, detail: Optional[dict] = None):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )

class UserForbidden(AuthorizationFailed):
    def __init__(self):
        super().__init__({
            'event': 'FORBIDDEN',
        })
