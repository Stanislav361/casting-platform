from shared.services.s3.client import S3Client, WaiterConfig
from shared.services.s3.services.base import S3BaseService
from config import settings

class S3MediaService(S3BaseService):
    def __init__(self, directory: str):
        super().__init__(
            bucket_name=settings.S3_MEDIA_BUCKET_NAME,
            directory=directory,
            # Проверка «файл появился» идёт внутри запроса пользователя: он
            # ждёт ответа, пока фото не сохранится. Прежние 30 секунд паузы и
            # 10 попыток давали до 5 минут ожидания на каждый файл, а на одно
            # фото их три (оригинал, обработанное, миниатюра) — при неполадках
            # хранилища загрузка зависала вместо быстрого перехода на локальный
            # диск. После успешного PUT объект доступен сразу, поэтому здесь
            # достаточно короткой проверки.
            waiter_config=WaiterConfig(delay=1, max_attempts=3),
            endpoint_url=settings.S3_MEDIA_ENDPOINT_URL,
            public_base_url=settings.S3_MEDIA_PUBLIC_BASE_URL,
            access_key=settings.S3_MEDIA_ACCESS_KEY,
            secret_key=settings.S3_MEDIA_SECRET_KEY,
            region_name=settings.S3_MEDIA_REGION_NAME,
        )