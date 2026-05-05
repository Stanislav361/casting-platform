from celery import Celery
from config import settings
from celery.schedules import crontab
from docker.grafana.tempo.instrumentation import init_tracing
from docker.grafana.tempo.tempo_config import tracing_settings
from opentelemetry.instrumentation.celery import CeleryInstrumentor

tasks: list = [
    'background.backup.postgres.tasks',
]

celery_obj = Celery(
    'background.tasks',
    broker=f'{settings.REDIS_URL}/0',
    include=tasks,
    backend=f"{settings.REDIS_URL}/1"
)

# Инструментируем Celery только если трейсинг включён, иначе ловим warning'и о
# недоступном tempo-service на каждый запуск таска.
if tracing_settings.TEMPO_ENABLED:
    tracer = init_tracing()
    CeleryInstrumentor().instrument(celery=celery_obj, tracer_provider=tracer)


celery_obj.conf.update(
    timezone="Europe/Moscow",
    enable_utc=False,
    beat_schedule={
        "daily-postgres-backup": {
            "task": "background.backup.postgres.tasks.dump_db",
            "schedule": crontab(minute=0, hour=0),
            "args": (),
        },
    },
)

