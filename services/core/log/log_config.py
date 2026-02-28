from pydantic_settings import BaseSettings
from config import settings
from pathlib import Path
from os.path import dirname, abspath
import os
import logging

def get_log_file() -> Path:
    if settings.MODE == "LOCAL":
        return Path(f"{dirname(dirname(abspath(__file__)))}/dev/log/app.log")
    else:
        log_dir = "/var/log/prostoprobuy-mvp"
        os.makedirs(log_dir, exist_ok=True)
        return Path(f'{log_dir}/app.log')

class SafeFormatter(logging.Formatter):
    def format(self, record):
        record.otelTraceID = getattr(record, "otelTraceID", "-")
        record.otelSpanID = getattr(record, "otelSpanID", "-")
        record.otelServiceName = getattr(record, "otelServiceName", "-")
        return super().format(record)

class LogSettings(BaseSettings):
    LOG_FILE: Path = get_log_file()
    PERIOD: str = 'midnight'
    BACKUP_MAX_COUNT: int = 7

log_settings = LogSettings()