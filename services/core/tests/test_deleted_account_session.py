"""
Проверка, что сессия удалённого аккаунта не оживает.

Реальный инцидент: пользователь удалил аккаунт, а refresh-cookie (живёт до
года) продолжала выдавать рабочий access-токен. Приложение открывалось,
показывало экран принятия документов, и любая попытка сохранить данные падала
с 500 — нарушение внешнего ключа `legal_consents.user_id -> users.id`. На
экране это выглядело как «Не удалось сохранить согласие. Попробуйте ещё раз.»
на каждой попытке.

Запуск (pytest не нужен):

    cd services/core && ./.venv/bin/python tests/test_deleted_account_session.py

Важно: заглушки ставятся ДО импорта проверяемых модулей — иначе подтянется
реальный .env и настоящее подключение к БД.
"""
from __future__ import annotations

import asyncio
import sys
import types
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _install_settings_stub() -> None:
    settings = types.SimpleNamespace(
        MODE="PROD",
        REFRESH_WEB_TOKEN_CONTAINER_NAME="refresh_web_token",
        REFRESH_TMA_TOKEN_CONTAINER_NAME="refresh_tma_token",
        ACCESS_TOKEN_HEADER_NAME="Authorization",
        SECRET_KEY="stub-secret",
        ALGORITHM="HS256",
        ACCESS_TOKEN_EXPIRE_MINUTES=60,
        REFRESH_TOKEN_EXPIRE_DAYS=365,
    )
    module = types.ModuleType("config")
    module.settings = settings  # type: ignore[attr-defined]
    sys.modules["config"] = module


class _FakeUser:
    def __init__(self, user_id: int, is_active: bool = True, is_deleted: bool = False):
        self.id = user_id
        self.is_active = is_active
        self.is_deleted = is_deleted


class _FakeSession:
    """Отдаёт заранее заданных пользователей по первичному ключу."""

    def __init__(self, users: dict[int, _FakeUser]):
        self._users = users

    async def get(self, _model, pk):
        return self._users.get(pk)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_exc):
        return False


def _install_db_stub(users: dict[int, _FakeUser]) -> None:
    """Подменяем postgres.database и users.models — account_guard берёт их лениво."""
    database = types.ModuleType("postgres.database")
    database.async_session_maker = lambda: _FakeSession(users)  # type: ignore[attr-defined]
    sys.modules["postgres.database"] = database

    models = types.ModuleType("users.models")
    models.User = _FakeUser  # type: ignore[attr-defined]
    sys.modules["users.models"] = models


_install_settings_stub()
_install_db_stub({
    1: _FakeUser(1),
    2: _FakeUser(2, is_active=False),
    3: _FakeUser(3, is_deleted=True),
})

from fastapi import HTTPException, Response  # noqa: E402

from users.services.account_guard import find_account, load_active_account  # noqa: E402
from users.services.auth_token.service import TokenService  # noqa: E402

failures = 0


def check(name: str, ok: bool, details: str = "") -> None:
    global failures
    if not ok:
        failures += 1
    print(f"{'OK  ' if ok else 'FAIL'} {name}" + (f" — {details}" if details and not ok else ""))


def expect_status(name: str, coro, status_code: int) -> None:
    try:
        asyncio.run(coro)
    except HTTPException as err:
        check(name, err.status_code == status_code, f"получен {err.status_code}")
        return
    check(name, False, "исключения не было")


def main() -> int:
    check(
        "существующий аккаунт находится",
        asyncio.run(find_account(1)) is not None,
    )
    check(
        "удалённый аккаунт не находится",
        asyncio.run(find_account(999)) is None,
    )
    check(
        "аккаунт, помеченный удалённым, не находится",
        asyncio.run(find_account(3)) is None,
    )
    check(
        "нечисловой id из битого токена не роняет проверку",
        asyncio.run(find_account("abc")) is None,
    )
    check(
        "активный аккаунт проходит проверку",
        asyncio.run(load_active_account(1)).id == 1,
    )
    expect_status(
        "сессия удалённого аккаунта получает 401, а не 500 при записи",
        load_active_account(999),
        401,
    )
    expect_status(
        "заблокированный аккаунт получает 403",
        load_active_account(2),
        403,
    )

    response = Response()
    TokenService.clear_refresh_token(response, "refresh_web_token")
    cookie = response.headers.get("set-cookie") or ""
    check(
        "refresh-cookie гасится с теми же атрибутами, что и выдаётся",
        "refresh_web_token=" in cookie
        and "Max-Age=0" in cookie
        and "Path=/" in cookie
        and "HttpOnly" in cookie
        and "SameSite=none" in cookie
        and "Secure" in cookie,
        f"заголовок: {cookie}",
    )

    print("\nВсе проверки пройдены." if failures == 0 else f"\nПровалено проверок: {failures}")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
