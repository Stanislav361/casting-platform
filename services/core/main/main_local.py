from fastapi import FastAPI, status
from routers.router_include import application_routers
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from config import settings
from log.middlewares import init_logs
from log.base import logger
from starlette_exporter import PrometheusMiddleware, handle_metrics
from background.cron_tasks import start_cron_tasks, stop_cron_tasks

# V2: Security & RBAC
from security.headers import SecurityHeadersMiddleware
from rbac.middleware import RBACMiddleware

app = FastAPI(
    title="Local API v2.0",
    openapi_version="3.0.0",
    docs_url='/docs',
    openapi_url='/openapi.json',
    redoc_url='/redoc/',
    )

import os
_uploads_env = os.environ.get("UPLOADS_DIR")
uploads_dir = Path(_uploads_env) if _uploads_env else Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.add_middleware(PrometheusMiddleware)

# Добавляем маршрут для экспорта метрик
app.add_route("/metrics", handle_metrics)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[h.strip() for h in settings.ALLOWED_HOSTS.split(",")],
    allow_credentials=True,  # Для cookie-based refresh tokens
    allow_methods=["*"],
    allow_headers=["*"],
)

# V2: Security Headers (L7 Security)
app.add_middleware(SecurityHeadersMiddleware)

# V2: RBAC Audit Middleware
app.add_middleware(RBACMiddleware)

init_logs(app=app)


@app.on_event("startup")
async def on_startup() -> None:
    start_cron_tasks()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await stop_cron_tasks()

@app.get('/is-health/')
async def health_check():
    logger.info('test logs from is health route')
    return status.HTTP_200_OK


app.include_router(application_routers)
