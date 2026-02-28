from pathlib import Path
from typing import Tuple, Optional
from PIL import Image as PILImage
from pillow_heif import register_heif_opener
from io import BytesIO
from fastapi import UploadFile
from shared.validation.image.exceptions import (
    HeaderImageFormatIsNotValid,
    ContentImageFormatIsNotValid,
    ImageContentIsEmpty,
    ImageSizeTooBig,
    ImageCorrupted
)
from shared.validation.image.configs.base import BaseImageConfig
from abc import ABC, abstractmethod

register_heif_opener()


class ImageValidate(ABC):

    def __init__(self, config: BaseImageConfig):
        self.config = config

    async def validate_image_size_from_content(self, content: bytes):
        image_size = len(content)
        if image_size > self.config.MAX_IMAGE_SIZE:
            raise ImageSizeTooBig(config=self.config)
        if image_size < 1:
            raise ImageContentIsEmpty

    async def validate_extension_from_header(self, image: UploadFile):
        image_extension = Path(image.filename).suffix[1:].lower()

        if image_extension not in self.config.ALLOWED_EXTENSIONS:
            raise HeaderImageFormatIsNotValid(config=self.config)

    async def validate_extension_from_content(self, content: bytes) -> str:
        try:
            with PILImage.open(BytesIO(content)) as img:  # noqa
                file_type = img.format.lower()

                if file_type not in self.config.ALLOWED_EXTENSIONS:
                    raise ContentImageFormatIsNotValid(config=self.config)

                img.verify()

                return file_type
        except Exception:
            raise ImageCorrupted

    @abstractmethod
    async def image_validate(self, *args, **kwargs) -> Tuple[bytes, str]:
        pass