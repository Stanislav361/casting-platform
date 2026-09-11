"""Ссылка кнопки «Откликнуться» в канале Telegram.

На Android обычный https://сайт/... из канала открывается во встроенном
браузере и остаётся чёрным экраном. Mini App-ссылка t.me/bot/app?startapp=
открывается как приложение на обеих платформах.

Запуск:

    cd services/core && ./.venv/bin/python tests/test_casting_deeplink.py
"""
from __future__ import annotations

import ast
from pathlib import Path
from types import SimpleNamespace

SOURCE = Path(__file__).resolve().parents[1] / (
    "castings/services/admin/telegram/channel/templates/types/buttons.py"
)

failures = 0


def check(name: str, cond: bool) -> None:
    global failures
    if cond:
        print(f"  ok  {name}")
        return
    failures += 1
    print(f"  FAIL {name}")


def load_functions():
    """Достаём функции без импорта модуля: у buttons.py круговой импорт схем."""
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    wanted = {"_bot_username", "_mini_app_short_name", "build_casting_deeplink"}
    namespace: dict = {}
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in wanted:
            exec(compile(ast.Module(body=[node], type_ignores=[]), str(SOURCE), "exec"), namespace)
    return namespace


def run() -> None:
    ns = load_functions()
    build_casting_deeplink = ns["build_casting_deeplink"]

    ns["settings"] = SimpleNamespace(
        TG_BOT_NAME="CastingProstoprobuyBot",
        TG_TMA_NAME="casting_platform_tma",
        PUBLIC_WEB_URL="https://prostoprobuy.pro",
    )
    check(
        "Mini App при заданных bot и app",
        build_casting_deeplink(42)
        == "https://t.me/CastingProstoprobuyBot/casting_platform_tma?startapp=casting_42",
    )

    ns["settings"] = SimpleNamespace(
        TG_BOT_NAME="@CastingProstoprobuyBot",
        TG_TMA_NAME="casting_platform_tma/",
        PUBLIC_WEB_URL="https://prostoprobuy.pro",
    )
    check(
        "срезает @ и завершающий слэш",
        build_casting_deeplink(7)
        == "https://t.me/CastingProstoprobuyBot/casting_platform_tma?startapp=casting_7",
    )

    ns["settings"] = SimpleNamespace(
        TG_BOT_NAME="CastingProstoprobuyBot",
        TG_TMA_NAME="",
        PUBLIC_WEB_URL="https://prostoprobuy.pro",
    )
    check(
        "без имени Mini App — startapp на бота",
        build_casting_deeplink(3) == "https://t.me/CastingProstoprobuyBot?startapp=casting_3",
    )

    ns["settings"] = SimpleNamespace(
        TG_BOT_NAME="",
        TG_TMA_NAME="",
        PUBLIC_WEB_URL="https://prostoprobuy.pro",
    )
    ns["public_web_base_url"] = lambda: "https://prostoprobuy.pro"
    check(
        "без бота — веб-страница кастинга",
        build_casting_deeplink(9) == "https://prostoprobuy.pro/cabinet/feed/9",
    )


if __name__ == "__main__":
    run()
    if failures:
        print(f"\n{failures} проверок не прошли")
        raise SystemExit(1)
    print("\nвсе проверки пройдены")
