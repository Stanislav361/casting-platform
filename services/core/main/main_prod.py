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
    docs_url=None,
    openapi_url=None,
    redoc_url=None,
    )

import os
_uploads_env = os.environ.get("UPLOADS_DIR")
uploads_dir = Path(_uploads_env) if _uploads_env else Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_HOSTS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# V2: Security Headers (L7 Security) — HSTS, CSP, X-Frame-Options и др.
app.add_middleware(SecurityHeadersMiddleware)

# V2: RBAC Audit Middleware
app.add_middleware(RBACMiddleware)

init_metrics(app=app)
trace_instrument_app(app=app)
init_logs(app=app)


@app.on_event("startup")
async def on_startup() -> None:
    start_cron_tasks()
    await _ensure_verification_tables()


async def _ensure_verification_tables():
    """Create verification_tickets / ticket_messages / general_chat_messages if missing."""
    from postgres.database import async_engine
    from sqlalchemy import text
    try:
        async with async_engine.begin() as conn:
            exists = await conn.execute(text(
                "SELECT to_regclass('public.verification_tickets')"
            ))
            if exists.scalar() is None:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS verification_tickets (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        status VARCHAR(20) NOT NULL DEFAULT 'open',
                        company_name VARCHAR(200),
                        about_text TEXT,
                        projects_text TEXT,
                        experience_text TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_verification_tickets_user_id "
                    "ON verification_tickets(user_id)"
                ))

            exists2 = await conn.execute(text(
                "SELECT to_regclass('public.ticket_messages')"
            ))
            if exists2.scalar() is None:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS ticket_messages (
                        id SERIAL PRIMARY KEY,
                        ticket_id INTEGER NOT NULL REFERENCES verification_tickets(id) ON DELETE CASCADE,
                        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        message TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_ticket_messages_ticket_id "
                    "ON ticket_messages(ticket_id)"
                ))

            exists3 = await conn.execute(text(
                "SELECT to_regclass('public.general_chat_messages')"
            ))
            if exists3.scalar() is None:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS general_chat_messages (
                        id SERIAL PRIMARY KEY,
                        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        message TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                    )
                """))
        print("[startup] verification tables ensured")
    except Exception as e:
        print(f"[startup] WARNING: could not ensure verification tables: {e}")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await stop_cron_tasks()

app.add_route("/metrics", handle_metrics)



@app.get('/is-health/')
async def health_check():
    return status.HTTP_200_OK


app.include_router(application_routers)
