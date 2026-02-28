from shared.validation.image.validations.base import ImageValidate
from fastapi import UploadFile
from typing import Tuple, Optional
from shared.validation.image.configs.casting import image_config as casting_image_conf
from io import BytesIO
from PIL import Image as PILImage




class CastingImageValidate(ImageValidate):

    def __init__(
            self,
            config=casting_image_conf,
    ):
        super().__init__(config=config)


    @staticmethod
    async def _convert_to_jpeg(content: bytes, quality: int = 90) -> bytes:
        with PILImage.open(BytesIO(content)) as img: # noqa
            if img.mode in ("RGBA", "LA", "P"):
                img = img.convert("RGB")
            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=quality, optimize=True)
            buffer.seek(0)
            return buffer.read()


    async def image_validate(self, image: UploadFile) -> Tuple[bytes, str]:
        content: bytes = await image.read()
        await self.validate_extension_from_header(image=image)
        await self.validate_image_size_from_content(content=content)
        file_type = await self.validate_extension_from_content(content=content)
        if file_type not in self.config.SUPPORTED_EXTENSIONS:
            content = await self._convert_to_jpeg(content, quality=90)
            file_type = "jpg"
        return content, file_type
