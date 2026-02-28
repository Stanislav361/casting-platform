from fastapi import HTTPException, status


class ProfileReportUniqueConstraintExc(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Часть актеров уже добавлены в отчет, обновите страницу и попробуйте еще раз"
            },
        )