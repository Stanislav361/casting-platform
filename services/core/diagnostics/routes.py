"""Приём отчётов о падениях приложения в браузере.

Зачем: экран «Произошла ошибка» рисует граница ошибок React, а она не поднимает
падение в window.onerror. В логах сервера не оставалось ни строчки — после
жалобы «не открывается» причину приходилось искать по скриншотам. Здесь
единственная задача: записать текст ошибки, адрес страницы и версию сборки в
журнал сервиса, чтобы инцидент можно было разобрать по логам.

Без авторизации — намеренно: чаще всего приложение падает до входа, токена в
этот момент нет. Данные никуда не сохраняются, только пишутся в лог, а поля
обрезаются по длине, поэтому худшее, чем грозит открытая ручка, — мусор в
журнале.
"""
import json
import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Request, Response, status

logger = logging.getLogger(__name__)

# Ограничения на длину: стек полезен, но раздувать журнал нельзя.
MAX_MESSAGE_LEN = 4000
MAX_FIELD_LEN = 500
MAX_BODY_BYTES = 16 * 1024


def _clip(value: Any, limit: int) -> Optional[str]:
    """Строка ограниченной длины или None. Любой тип приводим к строке."""
    if value is None:
        return None
    text = value if isinstance(value, str) else str(value)
    text = text.replace("\r", " ").strip()
    if not text:
        return None
    return text[:limit]


def _client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


class ClientErrorsRouter:
    """POST /client-errors/ — отчёт браузера об упавшем рендере."""

    def __init__(self):
        self.router = APIRouter(tags=["diagnostics"])
        self.include_routers()

    def include_routers(self) -> None:
        self.add_report_route()

    def add_report_route(self) -> None:
        @self.router.post('/client-errors/', status_code=status.HTTP_204_NO_CONTENT)
        async def report_client_error(request: Request) -> Response:
            # Тело разбираем вручную: схема Pydantic ответила бы 422 на любое
            # отклонение от формата, и отчёт о падении — ровно та вещь, которую
            # нельзя терять из-за придирки к формату.
            raw = await request.body()
            data: Dict[str, Any] = {}
            if raw and len(raw) <= MAX_BODY_BYTES:
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, dict):
                        data = parsed
                    else:
                        data = {"message": parsed}
                except (ValueError, UnicodeDecodeError):
                    data = {"message": raw[:MAX_MESSAGE_LEN].decode("utf-8", "replace")}

            fields = {
                "source": _clip(data.get("source"), 64) or "unknown",
                "digest": _clip(data.get("digest"), 64),
                "url": _clip(data.get("url"), MAX_FIELD_LEN),
                "build": _clip(data.get("build_id"), 64),
                "mode": _clip(data.get("display_mode"), 32),
                "stale_bundle": bool(data.get("stale_bundle")),
                "recovered": bool(data.get("recovered")),
                "ip": _clip(_client_ip(request), 64),
                "ua": _clip(request.headers.get("user-agent"), 200),
            }
            message = _clip(data.get("message"), MAX_MESSAGE_LEN) or "unknown error"

            logger.warning(
                "[CLIENT ERROR] %s | %s",
                " ".join(f"{key}={value}" for key, value in fields.items() if value is not None),
                message,
            )
            return Response(status_code=status.HTTP_204_NO_CONTENT)
