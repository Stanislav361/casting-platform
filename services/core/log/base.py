import logging
from logging.handlers import TimedRotatingFileHandler
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from log.fitlers import EndpointFilter
from log.log_config import log_settings
from config import settings
from log.log_config import SafeFormatter

formatter = SafeFormatter(
    "%(asctime)s %(levelname)s %(name)s %(filename)s:%(lineno)d "
    "[trace_id=%(otelTraceID)s span_id=%(otelSpanID)s service=%(otelServiceName)s] - %(message)s"
)

handler = TimedRotatingFileHandler(
    log_settings.LOG_FILE, when=log_settings.PERIOD, backupCount=log_settings.BACKUP_MAX_COUNT
)
handler.setFormatter(formatter)

logger = logging.getLogger(settings.API_SERVICE_NAME)
logger.addFilter(EndpointFilter())
logger.addHandler(handler)
logger.setLevel(getattr(logging, settings.LOG_LEVEL))

LoggingInstrumentor().instrument(set_logging_format=True)
