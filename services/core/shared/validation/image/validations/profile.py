from shared.validation.image.validations.base import ImageValidate
from fastapi import UploadFile
from typing import Tuple, Optional
from profiles.schemas.tma_user import SImageCoordinate
from shared.validation.image.exceptions import InvalidAspectRatio
from shared.validation.image.configs.profile import image_config as profile_image_conf
from PIL import Image as PILImage
from pathlib import Path
import io

class ProfileImageValidate(ImageValidate):

    def __init__(
            self,
            _2_3_coordinate: Optional[SImageCoordinate],
            config=profile_image_conf,
    ):
        super().__init__(config=config)
        self._2_3_coordinate = _2_3_coordinate

    def _coordinate_2_3_validate(self, ):
        coordinate = self._2_3_coordinate
        if coordinate:
            width = abs(coordinate.bottom_right.x - coordinate.top_left.x)
            height = abs(coordinate.bottom_right.y - coordinate.top_left.y)
            if height == 0:
                raise InvalidAspectRatio(aspect_ratio=(width, height))
            actual_ratio = width / height
            expected_ratio = 2 / 3
            tolerance = 0.1  # допустимая погрешность

            if not (expected_ratio - tolerance <= actual_ratio <= expected_ratio + tolerance):
                raise InvalidAspectRatio(aspect_ratio=(width, height))

    # def make_crop_box_for_pillow(self, image_bytes: bytes) -> tuple[int, int, int, int]:
    #     with PILImage.open(io.BytesIO(image_bytes)) as img: # noqa
    #         width, height = img.size
    #     left = int(round(min(self._2_3_coordinate.top_left.x, self._2_3_coordinate.bottom_right.x)))
    #     right = int(round(max(self._2_3_coordinate.top_left.x, self._2_3_coordinate.bottom_right.x)))
    #     top = int(round(height - max(self._2_3_coordinate.top_left.y, self._2_3_coordinate.bottom_right.y)))
    #     bottom = int(round(height - min(self._2_3_coordinate.top_left.y, self._2_3_coordinate.bottom_right.y)))
    #     left = max(0, min(left, width))
    #     right = max(0, min(right, width))
    #     top = max(0, min(top, height))
    #     bottom = max(0, min(bottom, height))
    #
    #     if right <= left or bottom <= top:
    #         raise ValueError("Invalid crop box: resulting rectangle is empty or inverted")
    #
    #     return left, top, right, bottom

    def make_crop_box_for_pillow(self, image_bytes: bytes) -> tuple[int, int, int, int]:
        # with PILImage.open(io.BytesIO(image_bytes)) as img: # noqa
        #     width, height = img.size
        left = self._2_3_coordinate.top_left.x
        right = self._2_3_coordinate.bottom_right.x
        top = self._2_3_coordinate.top_left.y
        bottom = self._2_3_coordinate.bottom_right.y

        return left, top, right, bottom


    def _crop_image(self, image_bytes: bytes) -> bytes:
        image = PILImage.open(io.BytesIO(image_bytes)) # noqa
        cropped_image = image.crop(self.make_crop_box_for_pillow(image_bytes))
        output = io.BytesIO()
        cropped_image.save(output, format=image.format or 'JPEG')
        return output.getvalue()
    
    def get_file_type_from_content_type(self, image: UploadFile) -> str:
        if image.content_type:
            return image.content_type.split("/")[-1].lower()
        return image.filename.rsplit(".", 1)[-1].lower()

    async def image_validate(self, image: UploadFile) -> Tuple[bytes, bytes, str]:
        content: bytes = await image.read()

        await self.validate_extension_from_header(image=image)

        # self._coordinate_2_3_validate()

        await self.validate_image_size_from_content(content=content)

        file_type = await self.validate_extension_from_content(content=content)

        # content_2_3: bytes = self._crop_image(content)

        content_2_3: bytes = content

        return content, content_2_3, file_type
