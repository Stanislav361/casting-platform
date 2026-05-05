from typing import Optional
from celery import Celery
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.celery import CeleryInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.aiohttp_client import AioHttpClientInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from postgres.database import async_engine
from starlette.types import ASGIApp
from docker.grafana.tempo.tempo_config import tracing_settings
from opentelemetry.instrumentation.logging import LoggingInstrumentor

def init_tracing(app_name: str = tracing_settings.API_SERVICE_NAME):
    # Если Tempo не включён в окружении (например, на Railway) — пропускаем
    # инициализацию OTLP экспортёра, чтобы не засорять логи бесконечными
    # warning'ами о недоступности `tempo-service:4318`.
    if not tracing_settings.TEMPO_ENABLED:
        return None

    tracer = TracerProvider(resource=Resource.create(attributes={"service.name": app_name}))
    trace.set_tracer_provider(tracer)

    otlp_exporter = OTLPSpanExporter(
        endpoint=f"{tracing_settings.TEMPO_HOST}:{tracing_settings.TEMPO_GRPC_PORT}",
        insecure=tracing_settings.INSECURE
    )
    span_processor = BatchSpanProcessor(otlp_exporter)
    tracer.add_span_processor(span_processor)

    return tracer


def trace_instrument_app(app: Optional[ASGIApp] = None) -> None:
    # Если трейсинг выключен (Railway-like окружение) — выходим тихо.
    if not tracing_settings.TEMPO_ENABLED:
        return

    init_tracing()
    LoggingInstrumentor().instrument(set_logging_format=True)
    if app:
        FastAPIInstrumentor.instrument_app(app)
    RequestsInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()
    AioHttpClientInstrumentor().instrument()

    SQLAlchemyInstrumentor().instrument(
        engine=async_engine.sync_engine,
        service_name=tracing_settings.API_SERVICE_NAME,
    )