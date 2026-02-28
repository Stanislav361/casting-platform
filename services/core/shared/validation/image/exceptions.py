from fastapi import HTTPException, status
from shared.validation.image.configs.base import BaseImageConfig


class BaseImageIsNotValid(Exception):
    pass

class HeaderImageFormatIsNotValid(Exception):
    def __init__(self, config: BaseImageConfig):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                'message': 'Image format is not supported (incorrect header)',
                'supported_formats': config.ALLOWED_EXTENSIONS
            },
        )

class ContentImageFormatIsNotValid(Exception):
    def __init__(self, config: BaseImageConfig):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                'message': 'Image format is not supported (incorrect content)',
                'supported_formats': config.ALLOWED_EXTENSIONS
            },
        )

class ImageSizeTooBig(Exception):

    def __init__(self, config: BaseImageConfig):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Размер изображения не должен быть больше {config.MAX_IMAGE_SIZE}",
        )

class ImageContentIsEmpty(Exception):

    def __init__(self):
        self.API_ERR = HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail='Поврежденное изображение'
        )


class ImageCorrupted(Exception):

    def __init__(self):
        self.API_ERR =  HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Изображение повреждено'
        )

class InvalidAspectRatio(Exception):
    def __init__(self, aspect_ratio: tuple):
        self.width, self.height = aspect_ratio
        self.API_ERR = HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": 'Соотношение должно быть 2:3 (с погрешностью ~0.1)',
                "current_ratio": f"{self.width}:{self.height}",
                "expected_ratio": "2:3"
            }
        )

