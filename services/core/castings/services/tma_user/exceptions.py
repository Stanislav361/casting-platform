from fastapi import HTTPException, status

class CastingIdIsNotFound(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "такого кастинга не существует"
            },
        )

