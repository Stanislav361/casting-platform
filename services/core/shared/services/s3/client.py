from config import settings
from aiobotocore.session import get_session, AioSession
from botocore.config import Config
from contextlib import asynccontextmanager
from typing import Dict, Optional
from pydantic import BaseModel, Field

class WaiterConfig(BaseModel):
    Delay: int = Field(..., alias='delay')
    MaxAttempts: int = Field(..., alias='max_attempts')


# Хранилище отвечает не всегда. Без явных таймаутов botocore ждёт соединение
# 60 секунд и повторяет запрос до пяти раз, то есть недоступное хранилище
# держит запрос пользователя минутами: загрузка фото не падает и не уходит в
# локальный фолбэк, а просто «висит», пока браузер сам не отвалится по
# таймауту. Ограничиваем ожидание, чтобы отказ хранилища был быстрым и
# заметным, а загрузка успевала переключиться на локальный диск.
CONNECT_TIMEOUT = 5  # На установку соединения этого хватает с запасом.
READ_TIMEOUT = 60    # Ответ на PUT приходит после отправки всего файла.
MAX_ATTEMPTS = 2     # Одна повторная попытка на случай сетевой помехи.


class S3Client:
    def __init__(
            self,
            endpoint_url: str,
            access_key: str,
            secret_key: str,
            waiter_config: WaiterConfig,
            region_name: Optional[str] = None,
    ):
        self.config = {
            'aws_access_key_id': access_key,
            'aws_secret_access_key': secret_key,
            'endpoint_url': endpoint_url.rstrip('/'),
            'config': Config(
                signature_version='s3v4',
                s3={'addressing_style': 'path'},
                connect_timeout=CONNECT_TIMEOUT,
                read_timeout=READ_TIMEOUT,
                retries={'max_attempts': MAX_ATTEMPTS, 'mode': 'standard'},
            ),
        }
        if region_name:
            self.config['region_name'] = region_name
        self.waiter_config: Dict = waiter_config.model_dump()
        self.session: AioSession = get_session()

    @asynccontextmanager
    async def get_context(self):
        async with self.session.create_client('s3', **self.config) as s3_client:
            yield s3_client