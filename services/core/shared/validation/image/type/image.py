import base64
import uuid
from shared.services.s3.services.media import S3MediaService
from typing import Optional

class Image:
    def __init__(self, s3: S3MediaService, content: bytes, image_type: str, crop_content: Optional[bytes] = None):
        self._image_id = self._get_image_id()
        self._image_type = image_type
        self._content = content
        self._crop_content = crop_content
        self._photo_url = self._get_photo_url(s3, image_name=f'{self._image_id}.{self._image_type}')
        self._crop_photo_url = self._get_photo_url(s3, image_name=f'{self._image_id}_crop.{self._image_type}')

    @staticmethod
    def _get_photo_url(s3: S3MediaService, image_name, ) -> str:
        return f"{s3.base_url}/{image_name}"

    @staticmethod
    def _get_image_id() -> str:
        return  (
            base64
            .urlsafe_b64encode(uuid.uuid4().bytes) # noqa
            .rstrip(b"=") # noqa
            .decode("ascii")
        )

    @property
    def image_name(self) -> str:
        return f'{self._image_id}.{self._image_type}'

    @property
    def crop_image_name(self) -> str:
        return f'{self._image_id}_crop.{self._image_type}'

    @property
    def image_type(self) -> str:
        return self._image_type

    @property
    def photo_url(self) -> str:
        return self._photo_url

    @property
    def crop_photo_url(self) -> str:
        return self._crop_photo_url

    @property
    def content(self) -> bytes:
        return self._content

    @property
    def crop_content(self) -> Optional[bytes]:
        return self._crop_content

    def __str__(self):
        return self._photo_url
