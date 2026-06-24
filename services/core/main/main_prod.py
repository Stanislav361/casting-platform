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
    docs_url="/docs",
    openapi_url="/openapi.json",
    redoc_url=None,
    )

import os
_uploads_env = os.environ.get("UPLOADS_DIR")
uploads_dir = Path(_uploads_env) if _uploads_env else Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

_allowed_origins = [
    h.strip() for h in (settings.ALLOWED_HOSTS or "").split(",") if h.strip()
]
if not _allowed_origins:
    _allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
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
    await _ensure_response_actor_profile()
    await _ensure_email_default_channel()


async def _ensure_email_default_channel():
    """Делаем email каналом уведомлений по умолчанию для тех, у кого есть почта.

    Раз коды на регистрацию приходят на email — значит почта рабочая, и это
    самый надёжный канал (надёжнее web push на Android). Колокольчик в
    приложении остаётся в любом случае.

    Бэкфилл РАЗОВЫЙ (с маркером в pp_migration_marks): иначе при каждом рестарте
    мы бы сбрасывали выбор тем, кто потом сам переключился на «в приложении».
    Новые пользователи получают 'email' прямо при регистрации.
    """
    from postgres.database import async_engine
    from sqlalchemy import text
    try:
        async with async_engine.begin() as conn:
            await conn.execute(text(
                "CREATE TABLE IF NOT EXISTS pp_migration_marks ("
                "name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
            ))
            already = await conn.execute(text(
                "SELECT 1 FROM pp_migration_marks WHERE name = 'casting_email_default_v1'"
            ))
            if already.first():
                return
            await conn.execute(text(
                "UPDATE users SET casting_notification_channel = 'email' "
                "WHERE email IS NOT NULL AND email <> '' "
                "AND (casting_notification_channel IS NULL "
                "OR casting_notification_channel = 'in_app')"
            ))
            await conn.execute(text(
                "INSERT INTO pp_migration_marks (name) VALUES ('casting_email_default_v1') "
                "ON CONFLICT (name) DO NOTHING"
            ))
        print("[startup] email default channel backfill applied")
    except Exception as e:
        print(f"[startup] WARNING: email-default backfill skipped: {e}")


async def _ensure_response_actor_profile():
    """Мультипрофиль актёра: колонка actor_profile_id в profile_responses.

    ВАЖНО: каждый шаг — в ОТДЕЛЬНОЙ транзакции с своим try/except. Если
    бэкфилл или смена констрейнта упадут, это НЕ должно откатывать добавление
    самой колонки — иначе ORM (в модели колонка уже есть) будет падать на
    каждом запросе к откликам, и «Мои отклики» покажут пусто.
    """
    from postgres.database import async_engine
    from sqlalchemy import text

    steps = [
        # 1) Колонка + индекс — критично, должно примениться.
        "ALTER TABLE profile_responses ADD COLUMN IF NOT EXISTS actor_profile_id INTEGER",
        "CREATE INDEX IF NOT EXISTS ix_profile_responses_actor_profile_id "
        "ON profile_responses(actor_profile_id)",
        # 2) Бэкфилл из self_test_url ([id]) — необязателен (старые отклики и так
        #    видны через actor_profile_id IS NULL). Ограничиваем длину числа,
        #    чтобы не словить переполнение int4.
        "UPDATE profile_responses "
        "SET actor_profile_id = substring(self_test_url from '[0-9]+')::int "
        "WHERE actor_profile_id IS NULL AND self_test_url ~ '^\\[[0-9]{1,9}\\]$'",
        # 3) Снимаем старый уникальный ключ (один отклик на аккаунт на кастинг).
        "ALTER TABLE profile_responses DROP CONSTRAINT IF EXISTS uq_profile_id_casting_id",
        # 4) Новый уникальный ключ — по конкретной анкете. Может не создаться при
        #    исторических дублях — это не критично, дедуп есть и в коде.
        "DO $$ BEGIN "
        "IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_actor_profile_casting') THEN "
        "ALTER TABLE profile_responses ADD CONSTRAINT uq_actor_profile_casting "
        "UNIQUE (actor_profile_id, casting_id); END IF; "
        "EXCEPTION WHEN others THEN NULL; END $$;",
    ]
    for sql in steps:
        try:
            async with async_engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as e:
            print(f"[startup] WARNING: response actor_profile_id step skipped: {e}")


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
            await conn.execute(text(
                "ALTER TABLE profile_responses ADD COLUMN IF NOT EXISTS "
                "status VARCHAR(20) NOT NULL DEFAULT 'pending'"
            ))

            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS project_collaborators (
                    id SERIAL PRIMARY KEY,
                    casting_id INTEGER NOT NULL REFERENCES castings(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role VARCHAR(20) NOT NULL DEFAULT 'editor',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE(casting_id, user_id)
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_collab_casting ON project_collaborators(casting_id)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_collab_user ON project_collaborators(user_id)"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS admin_team_members (
                    id SERIAL PRIMARY KEY,
                    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role VARCHAR(20) NOT NULL DEFAULT 'editor',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE(owner_id, user_id)
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_admin_team_owner ON admin_team_members(owner_id)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_admin_team_user ON admin_team_members(user_id)"
            ))
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS admin_team_chat_messages (
                    id SERIAL PRIMARY KEY,
                    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_admin_team_chat_owner ON admin_team_chat_messages(owner_id)"
            ))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_admin_team_chat_created ON admin_team_chat_messages(created_at)"
            ))
            await conn.execute(text(
                "ALTER TABLE castings ADD COLUMN IF NOT EXISTS parent_project_id INTEGER REFERENCES castings(id) ON DELETE CASCADE"
            ))

            for col in ['telegram_nick', 'vk_nick', 'max_nick', 'middle_name']:
                await conn.execute(text(
                    f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} VARCHAR(100)"
                ))

            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS project_chat_messages (
                    id SERIAL PRIMARY KEY,
                    casting_id INTEGER NOT NULL REFERENCES castings(id) ON DELETE CASCADE,
                    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_pcm_casting ON project_chat_messages(casting_id)"
            ))

            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS push_subscriptions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    endpoint TEXT NOT NULL UNIQUE,
                    p256dh VARCHAR(255) NOT NULL,
                    auth VARCHAR(255) NOT NULL,
                    user_agent VARCHAR(500),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_push_sub_user ON push_subscriptions(user_id)"
            ))

            # Чиним «битые» картинки: раньше за прокси Railway request.base_url был
            # http://, и часть ссылок на /uploads/... сохранилась с http. На
            # https-странице браузер блокирует их как mixed content. Разово
            # переводим уже сохранённые ссылки на https (localhost не трогаем).
            for _table, _col in [
                ("casting_images", "photo_url"),
                ("media_assets", "original_url"),
                ("media_assets", "processed_url"),
                ("media_assets", "thumbnail_url"),
                ("users", "photo_url"),
            ]:
                await conn.execute(text(
                    f"UPDATE {_table} SET {_col} = 'https://' || substring({_col} from 8) "
                    f"WHERE {_col} LIKE 'http://%' "
                    f"AND {_col} NOT LIKE 'http://localhost%' "
                    f"AND {_col} NOT LIKE 'http://127.%' "
                    f"AND {_col} NOT LIKE 'http://192.168.%' "
                    f"AND {_col} NOT LIKE 'http://10.%'"
                ))

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
