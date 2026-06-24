from fastapi import FastAPI, status
from routers.router_include import application_routers
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from config import settings
from docker.grafana.prometheus.metrics import init_metrics
from docker.grafana.tempo.instrumentation import trace_instrument_app
from log.middlewares import init_logs
from starlette_exporter import handle_metrics
from background.cron_tasks import start_cron_tasks, stop_cron_tasks

# V2: Security & RBAC
from security.headers import SecurityHeadersMiddleware
from rbac.middleware import RBACMiddleware

app = FastAPI(
    title="Development API v2.0",
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


_allowed_origins = [
    h.strip() for h in (settings.ALLOWED_HOSTS or "").split(",") if h.strip()
]

# CORS по регекспу для прод/дев/railway/localhost доменов — чтобы вход работал
# даже если ALLOWED_HOSTS не настроен под новый домен (например prostoprobuy.pro).
# С allow_credentials=True использовать "*" нельзя, поэтому матчим источники регекспом.
_allowed_origin_regex = (
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    r"|^https://([a-z0-9-]+\.)*prostoprobuy\.pro$"
    r"|^https://([a-z0-9-]+\.)*prostoprobuy-prod\.ru$"
    r"|^https://([a-z0-9-]+\.)*prostoprobuy-dev\.ru$"
    r"|^https://([a-z0-9-]+\.)*up\.railway\.app$"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_origin_regex=_allowed_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# V2: Security Headers (L7 Security)
app.add_middleware(SecurityHeadersMiddleware)

# V2: RBAC Audit Middleware
app.add_middleware(RBACMiddleware)

init_metrics(app=app)
trace_instrument_app(app=app)
init_logs(app=app)


@app.on_event("startup")
async def on_startup() -> None:
    start_cron_tasks()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await stop_cron_tasks()

app.add_route("/metrics", handle_metrics)



@app.get('/is-health/')
async def health_check():
    return status.HTTP_200_OK


app.include_router(application_routers)
