from pydantic_settings import BaseSettings
from config import settings

class TracingSettings(BaseSettings):
    API_SERVICE_NAME: str = settings.API_SERVICE_NAME
    TEMPO_HOST: str = "tempo-service"   # имя контейнера в Docker-сети
    TEMPO_GRPC_PORT: int = 4318         # gRPC OTLP порт
    TEMPO_HTTP_PORT: int = 4319         # HTTP OTLP порт, если используешь HTTP
    INSECURE: bool = True               # обычно True для внутренней сети
    # В проде (Railway) Tempo нет — трейсинг по умолчанию выключен.
    # Включить локально через переменную окружения: TEMPO_ENABLED=true
    TEMPO_ENABLED: bool = False

tracing_settings = TracingSettings()