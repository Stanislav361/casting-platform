"""
Проверка CSRF-защиты и списка доверенных источников.

Запуск (pytest не нужен, достаточно starlette/httpx):

    cd services/core && ./.venv/bin/python tests/test_csrf.py

Сценарии повторяют реальную атаку: чужой сайт пытается дёрнуть
`/auth/v2/refresh/`, к которому браузер сам приложит нашу refresh-cookie.

Важно: заглушка настроек ставится ДО импорта пакета `security` — иначе
подтянется реальный .env разработчика и проверки поедут.
"""
from __future__ import annotations

import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _install_settings_stub() -> None:
    """Подменяем config.settings, чтобы тест не требовал реального .env."""
    settings = types.SimpleNamespace(
        MODE="PROD",
        ALLOWED_HOSTS="https://prostoprobuy.pro,https://www.prostoprobuy.pro",
        PUBLIC_WEB_URL="https://prostoprobuy.pro",
        REFRESH_WEB_TOKEN_CONTAINER_NAME="refresh_web_token",
        REFRESH_TMA_TOKEN_CONTAINER_NAME="refresh_tma_token",
    )
    module = types.ModuleType("config")
    module.settings = settings  # type: ignore[attr-defined]
    sys.modules["config"] = module


_install_settings_stub()

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from security.csrf import CSRFProtectionMiddleware  # noqa: E402
from security.origins import get_allowed_origins, get_allowed_origin_regex  # noqa: E402

TRUSTED = "https://prostoprobuy.pro"
ATTACKER_ON_RAILWAY = "https://evil-app-production.up.railway.app"
ATTACKER = "https://evil.example"
REFRESH_COOKIE = {"refresh_web_token": "stub-refresh-token"}


def build_client() -> TestClient:
    app = FastAPI()

    @app.post("/auth/v2/refresh/")
    async def refresh():
        return {"access_token": "new-access-token"}

    @app.get("/castings/")
    async def castings():
        return {"items": []}

    app.add_middleware(CSRFProtectionMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(get_allowed_origins()),
        allow_origin_regex=get_allowed_origin_regex(),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return TestClient(app)


def main() -> int:
    client = build_client()
    failures = 0

    def check(name: str, condition: bool, detail: str = "") -> None:
        nonlocal failures
        if condition:
            print(f"  OK   {name}")
        else:
            failures += 1
            print(f"  FAIL {name}{f' — {detail}' if detail else ''}")

    print("Доверенные источники:", ", ".join(get_allowed_origins()))
    print("Регексп-исключение в PROD:", get_allowed_origin_regex())

    print("\nАтаки на refresh (cookie браузер приложит сам):")

    response = client.post(
        "/auth/v2/refresh/",
        headers={"origin": ATTACKER_ON_RAILWAY},
        cookies=REFRESH_COOKIE,
    )
    check(
        "чужое приложение на *.up.railway.app отклонено",
        response.status_code == 403,
        f"получен {response.status_code}",
    )

    response = client.post(
        "/auth/v2/refresh/",
        headers={"origin": ATTACKER},
        cookies=REFRESH_COOKIE,
    )
    check("посторонний домен отклонён", response.status_code == 403, f"получен {response.status_code}")

    response = client.post("/auth/v2/refresh/", cookies=REFRESH_COOKIE)
    check(
        "запрос без Origin с нашей cookie отклонён",
        response.status_code == 403,
        f"получен {response.status_code}",
    )

    response = client.post(
        "/auth/v2/refresh/",
        headers={"referer": f"{ATTACKER}/page"},
        cookies=REFRESH_COOKIE,
    )
    check(
        "чужой Referer при отсутствии Origin отклонён",
        response.status_code == 403,
        f"получен {response.status_code}",
    )

    response = client.post(
        "/auth/v2/refresh/",
        headers={"origin": "https://prostoprobuy.pro.evil.example"},
        cookies=REFRESH_COOKIE,
    )
    check(
        "домен-двойник prostoprobuy.pro.evil.example отклонён",
        response.status_code == 403,
        f"получен {response.status_code}",
    )

    print("\nЛегитимная работа приложения не сломана:")

    response = client.post(
        "/auth/v2/refresh/",
        headers={"origin": TRUSTED},
        cookies=REFRESH_COOKIE,
    )
    check("наш фронтенд обновляет токен", response.status_code == 200, f"получен {response.status_code}")
    check(
        "и получает CORS-разрешение на чтение ответа",
        response.headers.get("access-control-allow-origin") == TRUSTED,
        f"заголовок: {response.headers.get('access-control-allow-origin')}",
    )

    response = client.post(
        "/auth/v2/refresh/",
        headers={"origin": "https://www.prostoprobuy.pro"},
        cookies=REFRESH_COOKIE,
    )
    check("вариант с www работает", response.status_code == 200, f"получен {response.status_code}")

    response = client.post(
        "/auth/v2/refresh/",
        headers={"origin": "https://ProstoProbuy.PRO"},
        cookies=REFRESH_COOKIE,
    )
    check("регистр в Origin не ломает вход", response.status_code == 200, f"получен {response.status_code}")

    response = client.post(
        "/auth/v2/refresh/",
        headers={"referer": f"{TRUSTED}/login"},
        cookies=REFRESH_COOKIE,
    )
    check("доверенный Referer без Origin принят", response.status_code == 200, f"получен {response.status_code}")

    response = client.post("/auth/v2/refresh/")
    check(
        "серверный запрос без Origin и без cookie не блокируется",
        response.status_code == 200,
        f"получен {response.status_code}",
    )

    response = client.get("/castings/", headers={"origin": ATTACKER})
    check(
        "чтение (GET) не блокируется CSRF-фильтром",
        response.status_code == 200,
        f"получен {response.status_code}",
    )
    check(
        "но чужому источнику CORS не разрешает прочитать ответ",
        "access-control-allow-origin" not in response.headers,
        f"заголовок: {response.headers.get('access-control-allow-origin')}",
    )

    response = client.options(
        "/auth/v2/refresh/",
        headers={
            "origin": ATTACKER_ON_RAILWAY,
            "access-control-request-method": "POST",
        },
    )
    check(
        "preflight чужого источника не получает разрешения",
        "access-control-allow-origin" not in response.headers,
        f"заголовок: {response.headers.get('access-control-allow-origin')}",
    )

    print("\nВсе проверки пройдены." if failures == 0 else f"\nПровалено проверок: {failures}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
