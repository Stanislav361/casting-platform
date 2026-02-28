from shared.services.s3.client import WaiterConfig
from shared.services.s3.services.base import S3BaseService
from config import settings
from http.client import HTTPException

class S3BackupService(S3BaseService):
    def __init__(self, ):
        super().__init__(
            bucket_name=settings.S3_BACKUP_BUCKET_NAME,
            directory='',
            waiter_config=WaiterConfig(delay=30, max_attempts=10),
            endpoint_url=settings.S3_BACKUP_ENDPOINT_URL,
        )

    async def download_file(
            self,
            key: str,
    ):
        try:
            async with self.client.get_context() as s3_client:
                response = await s3_client.get_object(Bucket=self.bucket_name, Key=key)
                data = await response["Body"].read()
                return data
        except s3_client.exceptions.NoSuchKey:
            raise HTTPException()

    async def get_last_backup_filename(self, ):
        async with self.client.get_context() as s3_client:
            dumps = (await s3_client.list_objects(Bucket=self.bucket_name))['Contents']
            dumps.sort(key=lambda x: x['LastModified'])
            last_backup_filename = dumps[-1]
            #log this
            print(f"\U000023F3 Last backup in S3 is {last_backup_filename['Key']}, "
                  f"{round(last_backup_filename['Size'] / (1024 * 1024))} MB, "
                  f"download it")
            return last_backup_filename['Key']
