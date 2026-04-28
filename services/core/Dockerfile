FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    MODE=PROD

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ffmpeg && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./

RUN pip install --no-cache-dir \
    fastapi uvicorn gunicorn sqlalchemy alembic asyncpg psycopg2-binary \
    redis celery pydantic pydantic-settings "pydantic[email]" \
    python-jose python-multipart httpx pillow phonenumbers pytz \
    cryptography http-ece py-vapid pywebpush \
    boto3 aiobotocore beautifulsoup4 greenlet \
    starlette-exporter prometheus-client prometheus-fastapi-instrumentator \
    json-log-formatter termcolor commonmark aiogram gspread \
    google-api-python-client google-auth google-auth-httplib2 google-auth-oauthlib \
    pillow-heif opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp \
    opentelemetry-instrumentation-fastapi opentelemetry-instrumentation-sqlalchemy \
    opentelemetry-instrumentation-httpx opentelemetry-instrumentation-requests \
    opentelemetry-instrumentation-logging opentelemetry-instrumentation-celery \
    opentelemetry-instrumentation-aiohttp-client

COPY . /app/

RUN mkdir -p /app/dev/log

EXPOSE 8000

CMD ["sh", "-c", "python -m alembic upgrade heads && python -m uvicorn main.main_prod:app --host 0.0.0.0 --port ${PORT:-8000}"]
