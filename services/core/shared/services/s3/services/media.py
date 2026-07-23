from shared.services.s3.client import S3Client, WaiterConfig
from shared.services.s3.services.base import S3BaseService
from config import settings

class S3MediaService(S3BaseService):
    def __init__(self, directory: str):
        super().__init__(
            bucket_name=settings.S3_MEDIA_BUCKET_NAME,
            directory=directory,
            waiter_config=WaiterConfig(delay=30, max_attempts=10),
            endpoint_url=settings.S3_MEDIA_ENDPOINT_URL,
            public_base_url=settings.S3_MEDIA_PUBLIC_BASE_URL,
            access_key=settings.S3_MEDIA_ACCESS_KEY,
            secret_key=settings.S3_MEDIA_SECRET_KEY,
            region_name=settings.S3_MEDIA_REGION_NAME,
        )