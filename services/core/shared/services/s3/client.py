from config import settings
from aiobotocore.session import get_session, AioSession
from contextlib import asynccontextmanager
from typing import Dict
from pydantic import BaseModel, Field

class WaiterConfig(BaseModel):
    Delay: int = Field(..., alias='delay')
    MaxAttempts: int = Field(..., alias='max_attempts')


class S3Client:
    def __init__(
            self,
            endpoint_url: str,
            access_key: str,
            secret_key: str,
            waiter_config: WaiterConfig
    ):
        self.config = {
            'aws_access_key_id': access_key,
            'aws_secret_access_key': secret_key,
            'endpoint_url': endpoint_url,
        }
        self.waiter_config: Dict = waiter_config.model_dump()
        self.session: AioSession = get_session()

    @asynccontextmanager
    async def get_context(self):
        async with self.session.create_client('s3', **self.config) as s3_client:
            yield s3_client