from fastapi import HTTPException, status

class ProfileIdIsNotFound(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Этот актер не существует, обновите страницу и попробуйте еще раз"
            },
        )