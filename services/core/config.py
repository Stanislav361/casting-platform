import datetime
from typing import Literal, Optional
from pydantic import model_validator, ConfigDict
from pydantic_settings import BaseSettings
from os.path import dirname, abspath
import os
from enum import StrEnum
from pathlib import Path

class TmaAuthRuntimeFlag:
    AUTH_PREDICATE = True

class AdminAuthRuntimeFlag:
    AUTH_PREDICATE = True

tma_auth_flags = TmaAuthRuntimeFlag()
admin_auth_flags = AdminAuthRuntimeFlag()


class ModeDirs(StrEnum):
    env_files_path = f"{dirname(abspath(__file__))}/environments"
    LOCAL = f"{env_files_path}/local"
    DEV = f"{env_files_path}/development"
    PROD = f"{env_files_path}/production"

class Settings(BaseSettings):
    model_config = ConfigDict(extra="ignore")

    MODE: Literal['LOCAL', 'DEV', 'PROD']
    LOG_LEVEL: Literal['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
    POSTGRES_HOST: str
    POSTGRES_PORT: int
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str
    DATABASE_URL: Optional[str] = None
    SYNC_DATABASE_URL: Optional[str] = None

    REDIS_HOST: str = "localhost"
    REDIS_PORT: str = "6379"
    REDIS_PASSWORD: str = ""
    REDIS_URL: Optional[str] = None

    SECRET_KEY: str
    ALGORITHM: str

    ACCESS_TOKEN_HEADER_NAME: str
    REFRESH_WEB_TOKEN_CONTAINER_NAME: str
    REFRESH_TMA_TOKEN_CONTAINER_NAME: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int
    ALLOWED_HOSTS: str

    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_MEDIA_BUCKET_NAME: str
    S3_BACKUP_BUCKET_NAME: str
    S3_MEDIA_ENDPOINT_URL: str
    S3_BACKUP_ENDPOINT_URL: str

    TG_BOT_TOKEN: str
    TG_BOT_NAME: str
    TG_TMA_NAME: str
    TG_CHANEL_NAME: str

    VK_CLIENT_ID: str = ""
    VK_CLIENT_SECRET: str = ""

    YANDEX_CLIENT_ID: str = ""
    YANDEX_CLIENT_SECRET: str = ""

    SMS_PROVIDER: str = "none"
    SMSRU_API_ID: Optional[str] = None
    SMSRU_FROM: Optional[str] = None
    SMS_OTP_TEMPLATE: str = "Код входа prostoprobuy: {code}"

    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM: Optional[str] = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    VAPID_PUBLIC_KEY: Optional[str] = None
    VAPID_PRIVATE_KEY: Optional[str] = None
    VAPID_SUBJECT: str = "mailto:support@prostoprobuy.ru"

    # YANDEX_LOG_GROUP_ID: str
    GOOGLE_SERVICE_ACCOUNT_PATH: Optional[Path] = None
    GOOGLE_DELEGATE_USER: str

    API_SERVICE_NAME: str


    @model_validator(mode="after")
    def generate_service_accounts_path(self):
        mode = os.getenv('MODE', 'LOCAL')
        self.GOOGLE_SERVICE_ACCOUNT_PATH = Path(f"{getattr(ModeDirs, mode)}/service_accounts/google_service_account.json")
        return self

    @model_validator(mode="after")
    def assemble_database_urls(self):
        self.DATABASE_URL = (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
        self.SYNC_DATABASE_URL = (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )
        self.REDIS_URL = (
            f'redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}'
        )
        return self

    @classmethod
    def from_mode(cls):
        mode = os.getenv('MODE', 'LOCAL')
        env_file = f"{getattr(ModeDirs, mode)}/.env"
        return cls(_env_file=env_file, _env_file_encoding='utf-8') # noqa


settings = Settings.from_mode()


class SettingsPower(BaseSettings):
    DB_CONN_PARAMS: Optional[dict] = None

    @model_validator(mode="after")
    def assemble_args(self):

        if settings.MODE == 'LOCAL':
            self.DB_CONN_PARAMS = {
                'echo': False, 'pool_size': 1, 'max_overflow': 2, 'pool_timeout': 30, 'pool_recycle': 1800
            }

        if settings.MODE == 'DEV':
            self.DB_CONN_PARAMS = {
                'echo': False, 'pool_size': 20, 'max_overflow': 10, 'pool_timeout': 40, 'pool_recycle': 1800
            }

        if settings.MODE == 'PROD':
            self.DB_CONN_PARAMS = {
                'echo': False, 'pool_size': 20, 'max_overflow': 10, 'pool_timeout': 40, 'pool_recycle': 1800
            }
        return self

power_settings = SettingsPower()