from fastapi import HTTPException, status
from typing import Optional

class NotFound(Exception):
    def __init__(self, detail: Optional[dict] = None):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )