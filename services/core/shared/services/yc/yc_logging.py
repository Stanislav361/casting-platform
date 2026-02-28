import json
import logging
from enum import Enum

import yandexcloud
from pyclm.logging import Logger as YandexCloudLogger

from config import settings

class LoggerResource(Enum):
    core = "core"
    auth = "auth"
    relaxed = "relaxed"
    practices = "practices"
    permissions = "permissions"
    programs = "programs"
    topics = "topics"
    categories = "categories"
    users = "users"
    accounts = "accounts"
    favorites = "favorites"
    celery = "celery"
    telegram = "telegram"
    test = "test-case"


class Logger:
    """
    Logger for Yandex Cloud Logging
    """

    def __init__(self):
        self.dir = (f"{settings.BASE_DIR}/environments")
        self.log_group_id = settings.YANDEX_LOG_GROUP_ID
        self.service_account_key = self._read_service_account_key()
        self.sdk = yandexcloud.SDK(service_account_key=self.service_account_key)

    def _read_service_account_key(self):
        with open(f"{self.dir}/service_account.json") as file:
            key = json.load(file)
            return key

    def logger(self, resource_type: LoggerResource = LoggerResource.core, **kwargs):
        return YandexCloudLogger(
            sdk=self.sdk,
            log_group_id=self.log_group_id,
            resource_type=str(resource_type),
        )

    def _log(self, level: str, message: str, resource_type: LoggerResource, **kwargs):
        if settings.MODE == "PROD":
            return

        level = level.upper()

        log = self.logger(resource_type=resource_type)

        if level == "TRACE":
            log.trace(message)
        elif level == "DEBUG":
            log.debug(message)
        elif level == "INFO":
            log.info(message)
        elif level == "WARN":
            log.warn(message)
        elif level == "ERROR":
            log.error(message)
        elif level == "FATAL":
            log.fatal(message)

    def info(self, message, resource_type: LoggerResource, **kwargs):
        self._log("INFO", message, resource_type=resource_type, **kwargs)

    def warning(self, message, resource_type: LoggerResource, **kwargs):
        self._log("WARNING", message, resource_type=resource_type, **kwargs)

    def error(self, message, resource_type: LoggerResource, **kwargs):
        self._log("ERROR", message, resource_type=resource_type, **kwargs)

    def debug(self, message, resource_type: LoggerResource, **kwargs):
        if settings.DEBUG:
            print(f"DEBUG: {message} {kwargs}")
        else:
            self._log("DEBUG", message, resource_type=resource_type, **kwargs)

    def critical(self, message, resource_type: LoggerResource, **kwargs):
        self._log("CRITICAL", message, resource_type=resource_type, **kwargs)


class YandexCloudHandler(logging.Handler):

    def emit(self, record):
        Logger().warning(record.getMessage(), resource_type=LoggerResource.core, traceback=record.exc_info)


logger = Logger()