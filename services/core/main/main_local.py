from fastapi import FastAPI, status
from routers.router_include import application_routers
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from log.middlewares import init_logs
from log.base import logger
from starlette_exporter import PrometheusMiddleware, handle_metrics

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

@app.get('/is-health/')
async def health_check():
    logger.info('test logs from is health route')
    return status.HTTP_200_OK


app.include_router(application_routers)
