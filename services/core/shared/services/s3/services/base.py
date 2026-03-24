from http.client import HTTPException
from config import settings
from fastapi import File
from botocore.exceptions import ClientError, BotoCoreError
from shared.services.s3.client import S3Client, WaiterConfig


class S3BaseService:
    def __init__(
            self,
            endpoint_url: str,
            bucket_name: str,
            directory: str,
            waiter_config: WaiterConfig
    ):
        self.client: S3Client = S3Client(
            endpoint_url=endpoint_url,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            waiter_config=waiter_config,
        )
        self.bucket_name = bucket_name
        self.directory = directory

        self.base_url = f'{endpoint_url}/{directory}'

    # @asynccontextmanager
    # async def get_client(self):
    #     async with self.session.create_client('s3', **self.config) as s3_client:
    #         yield s3_client

    # async def get_image_size(self, link):
    #     try:
    #         key = f'{self.directory}/{str(link).split("/")[-1]}' # noqa
    #         async with self.get_client() as s3_client:
    #             response = await s3_client.head_object(Bucket=self.bucket_name, Key=key)
    #             image_size = round(response['ContentLength'] / (1024 * 1024), 2) # noqa
    #             return image_size
    #     except s3_client.exceptions.NoSuchKey:
    #         raise HTTPException()

    async def download_file(
            self,
            link,
    ):
        try:
            key = f'{self.directory}/{str(link).split("/")[-1]}'
            async with self.client.get_context() as s3_client:
                response = await s3_client.get_object(Bucket=self.bucket_name, Key=key)
                image_data = await response["Body"].read()
                return image_data
        except s3_client.exceptions.NoSuchKey:
            raise HTTPException()

    async def upload_file(
            self,
            file_name: str,
            file: File,
    ):
        key = f'{self.directory}/{file_name}'
        async with self.client.get_context() as s3_client:
            response = await s3_client.put_object(
                Bucket=self.bucket_name,
                Key=key,
                Body=file,
            )

            waiter = s3_client.get_waiter('object_exists')
            await waiter.wait(
                Bucket=self.bucket_name,
                Key=key,
                WaiterConfig=self.client.waiter_config
            )
            response_status = response['ResponseMetadata']['HTTPStatusCode']
            if response_status != 200:
                raise BotoCoreError

    async def delete_file(self, file_name: str):

        async with self.client.get_context() as s3_client:
            try:
                if file_name:
                    key = f'{self.directory}/{file_name}'
                    await s3_client.delete_object(Bucket=self.bucket_name, Key=key)
                    waiter = s3_client.get_waiter("object_not_exists")
                    await waiter.wait(
                        Bucket=self.bucket_name,
                        Key=key,
                        WaiterConfig=self.client.waiter_config
                    )
                    return True
                return False
            except ClientError as e:
                raise e

    async def rollback_uploaded_s3_files(self, file_keys: list):
        for file_key in file_keys:
            try:
                await self.delete_file(file_key)
            except Exception as delete_error:
                print(f"Failed to delete file {file_key}: {delete_error}")