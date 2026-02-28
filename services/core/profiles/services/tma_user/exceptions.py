from typing import List, Any

from fastapi import status, HTTPException
from errors import NotFound
from profiles.enums import ImageType


class PhoneNumberUniqueExc(Exception):

    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Такой номер телефона уже существует"
            },
        )

class EmailUniqueExc(Exception):

    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Такой почтовый адрес уже существует"
            },
        )

class ProfileNotFound(Exception):
    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Профиль еще не создан"
            }
        )

class ResponseOneToOneExc(Exception):
    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Профиль еще не создан"
            }
        )

class ImageNotFound(NotFound):
    def __init__(
        self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Image Not Found"
            }
        )


class ImageConditionExc(Exception):
    def __init__(
            self,
            required_fields: List[ImageType],
    ):
        # ru_adapter = {
        #     ImageType.portrait: "портрет",
        #     ImageType.side_profile: "в профиль",
        #     ImageType.full_body: "во весь рост",
        # }
        # required_fields = [ru_adapter[field] for field in required_fields]
        required_fields = [field.value for field in required_fields]

        self.API_ERR = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Чтобы отправить загрузите обязательные фотографии",
                "empty_fields": required_fields
            }
        )


class ProfileResponseUniqueExc(Exception):
    def __init__(
            self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Нельзя отправить анкету на один кастинг дважды",
            }
        )

class CastingIsNotExisting(Exception):
    def __init__(
            self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "message": "Такого кастинга не существует",
            }
        )

class CastingIsClosed(Exception):
    def __init__(
            self,
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": "Набор на кастинг уже закрыт",
            }
        )

class FieldsEmptyExc(Exception):
    def __init__(
            self,
            empty_fields: List[str],
    ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Пропущены обязательные поля",
                "empty_fields": empty_fields
            }
        )

class ImageMaxCounter(Exception):
    def __init__(self, max_quantity: int,):
        self.max_quantity = max_quantity
        self.API_ERR = HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                'message': 'Достигнут лимит количества фотографий',
                'max_quantity': self.max_quantity,
            }
        )

class ImageMinCounter(Exception):
    def __init__(self,):
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

class ImageCoordinatesExc(Exception):
    def __init__(self, err_details: list[dict[str, Any]]):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "Invalid image coordinates",
                "details": err_details
            }
        )

class ImageDeleteFailed(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail='Ошибка удаления, обратитесь в поддержку'
        )

class CityNotFoundException(Exception):
    def __init__(self, ):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Такого города не существует'
        )