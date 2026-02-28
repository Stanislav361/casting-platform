from fastapi import HTTPException, status

class CastingIdIsNotFound(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "такого кастинга не существует"
            },
        )

class CastingCantWasBeOpened(Exception):

    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Кастинг был объявлен ранее, нельзя объявить повторно"
            },
        )

class CastingCantWasBeUnPublish(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": 'Кастинг не может быть снят с публикации, он уже закрыт'
            },
        )

class CastingCantWasBeClosed(Exception):

    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Кастинг был закрыт ранее, нельзя закрыть повторно"
            },
        )

class CastingCantWasBeClosedUnPublish(Exception):

    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Кастинг не был опубликован ранее, его нельзя закрыть"
            },
        )

class CastingWasBeDeleted(Exception):

    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Кастинг был удален вручную на канале"
            },
        )
class CastingCantWasBeDeleted(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Кастинг не может быть удален"
            },
        )

class CastingCantWasBeDraft(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Кастинг уже в черновиках"
            },
        )

class CastingCantWasBeEdited(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": 'Кастинг не может быть изменен после публикации, поместите кастинг в черновики и попробуйте снова'
            },
        )

class CastingCantWasBeEditedClose(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": 'Кастинг не может быть изменен, он уже закрыт'
            },
        )

class PublishCastingCantWasBeDeleted(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Поместите кастинг в черновики, чтобы удалить его"
            },
        )

class ArchiveCastingCantWasBeDeleted(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Кастинг из архива не может быть удален"
            },
        )

class ImageIdIsNotFound(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "такого изображения не существует"
            },
        )


class ImageMaxCounter(Exception):
    def __init__(self, max_quantity: int, ):
        self.max_quantity = max_quantity
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'message': 'Достигнут лимит количества фотографий',
                'max_quantity': self.max_quantity,
            }
        )


class ImageMinCounter(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Вы не можете удалить это изображение, eго не существует",
        )


class ImageUploadFailed(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail='Ошибка загрузки изображения',
        )


class ImageDeleteFailed(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail='Ошибка удаления, обратитесь в поддержку'
        )

class ImageNotFound(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Изображение не найдено',
        )