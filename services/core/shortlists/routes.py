"""
SSOT Shortlist Routes — динамические шорт-листы.
"""
from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response, status, WebSocket, WebSocketDisconnect
from typing import Optional
from users.dependencies.auth_depends import employer_authorized
from users.services.auth_token.service import TokenService
from users.services.auth_token.types.jwt import JWT
from shortlists.service import ShortlistTokenService
from shortlists.schemas import (
    SShortlistExportRequest,
    SShortlistTokenCreate,
    SShortlistTokenResponse,
    SShortlistViewResponse,
)
import asyncio
import json
import logging

logger = logging.getLogger(__name__)


async def build_cast_list_pdf_response(
    request: Request,
    *,
    token: Optional[str] = None,
    report_id: Optional[int] = None,
    status_param: Optional[str] = None,
    keys: Optional[list[str]] = None,
) -> Response:
    """Собрать PDF каст листа и отдать его как файл.

    Общая точка для публичной ссылки (по токену) и кабинета заказчика
    (по id каст листа) — чтобы отчёт в обоих местах был абсолютно одинаковым.
    """
    from reports.services.pdf.service import CastListPdfService, parse_statuses

    try:
        statuses = parse_statuses(status_param)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    # Относительные ссылки на фото (`/uploads/...`) достраиваем до абсолютных
    # адресом этого же сервиса — иначе фото не скачается.
    base_url = str(request.base_url).rstrip("/")

    try:
        if token is not None:
            document = await CastListPdfService.build_for_token(
                token=token, statuses=statuses, keys=keys, base_url=base_url,
            )
        else:
            document = await CastListPdfService.build_for_report(
                report_id=report_id, statuses=statuses, keys=keys, base_url=base_url,
            )
    except Exception as exc:
        # Ловим широко намеренно: это публичная ручка, и любая внутренняя
        # поломка (нет шрифта в образе, ошибка вёрстки, недоступная БД) должна
        # превратиться в аккуратный 500, а не в трейсбек в ответе.
        logger.exception("PDF каст листа: не удалось собрать отчёт")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Не удалось сформировать PDF. Попробуйте позже.",
        ) from exc

    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"message": "Shortlist not found or token expired"},
        )

    return Response(
        content=document.content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": document.content_disposition,
            "Content-Length": str(len(document.content)),
            "X-Actors-Count": str(document.actors_count),
            "Cache-Control": "no-store",
        },
    )


class ShortlistRouter:
    def __init__(self):
        self.router = APIRouter(tags=["shortlists"], prefix="/shortlists")
        self.include_routers()

    def include_routers(self) -> None:
        self.add_create_token_route()
        self.add_get_view_route()
        self.add_export_pdf_routes()
        self.add_update_review_status_route()
        self.add_deactivate_token_route()
        self.add_websocket_route()

    def add_create_token_route(self):
        @self.router.post("/tokens/", response_model=SShortlistTokenResponse)
        async def create_shortlist_token(
            data: SShortlistTokenCreate,
            authorized: JWT = Depends(employer_authorized),
        ) -> SShortlistTokenResponse:
            """Создать токен доступа к шорт-листу (SSOT)."""
            token = await ShortlistTokenService.create_token(
                report_id=data.report_id,
                created_by=int(authorized.id),
                expires_in_hours=data.expires_in_hours,
                max_views=data.max_views,
            )
            return SShortlistTokenResponse(
                token=token.token,
                report_id=token.report_id,
                expires_at=str(token.expires_at) if token.expires_at else None,
                max_views=token.max_views,
            )

    def add_get_view_route(self):
        @self.router.get(
            "/view/{token}/",
            response_model=SShortlistViewResponse,
            response_model_exclude_none=True,
        )
        async def get_shortlist_view(
            token: str,
            request: Request,
        ) -> SShortlistViewResponse:
            """
            Получить актуальное представление шорт-листа по токену (SSOT).
            Данные всегда актуальны — кеш TTL 60s.

            Если запрос пришёл от авторизованного админа (валидный Bearer-токен),
            в ответ подмешиваются контактные данные актёров. Получатель публичной
            ссылки без входа токена не имеет — контакты ему не отдаются.
            """
            viewer_token: Optional[JWT] = None
            try:
                viewer_token = TokenService.validate_access_token(request)
            except Exception:
                viewer_token = None

            view_data = await ShortlistTokenService.get_shortlist_view(
                token=token,
                viewer_token=viewer_token,
            )
            if not view_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"message": "Shortlist not found or token expired"},
                )
            return SShortlistViewResponse(**view_data)

    def add_export_pdf_routes(self):
        @self.router.get("/view/{token}/export/pdf/")
        async def export_shortlist_pdf(
            token: str,
            request: Request,
            status_param: Optional[str] = Query(
                None,
                alias="status",
                description="all | new | accepted | reserve (можно через запятую)",
            ),
        ) -> Response:
            """Скачать каст лист в PDF (без авторизации — доступ по ссылке).

            GET-вариант удобен для «открыть/сохранить» одной ссылкой и
            выгружает каст лист целиком либо один статус.
            """
            return await build_cast_list_pdf_response(
                request, token=token, status_param=status_param,
            )

        @self.router.post("/view/{token}/export/pdf/")
        async def export_shortlist_pdf_selection(
            token: str,
            request: Request,
            payload: SShortlistExportRequest = Body(default_factory=SShortlistExportRequest),
        ) -> Response:
            """Скачать PDF ровно по тому списку, который открыт на экране.

            Состав и порядок актёров задаёт фронтенд через `keys`, поэтому в
            отчёт попадают применённые фильтры, поиск и сортировка. Тело
            запроса вместо query-строки — список ключей на большом каст листе
            не влезает в лимит длины URL.
            """
            return await build_cast_list_pdf_response(
                request,
                token=token,
                status_param=payload.status,
                keys=payload.keys,
            )

    def add_update_review_status_route(self):
        @self.router.post("/view/{token}/profiles/{profile_id}/status/")
        @self.router.patch("/view/{token}/profiles/{profile_id}/status/")
        async def update_review_status(
            token: str,
            profile_id: int,
            new_status: str = Query(..., description="new | accepted | reserve"),
            actor_profile_id: Optional[int] = Query(None),
        ):
            """Update actor review status in a public shortlist (no auth required)."""
            ok = await ShortlistTokenService.update_profile_review_status(
                token=token,
                profile_id=profile_id,
                new_status=new_status,
                actor_profile_id=actor_profile_id,
            )
            if not ok:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Could not update status",
                )
            return {"ok": True}

    def add_deactivate_token_route(self):
        @self.router.delete("/tokens/{token_id}/")
        async def deactivate_token(
            token_id: int,
            authorized: JWT = Depends(employer_authorized),
        ) -> int:
            """Деактивировать токен шорт-листа."""
            await ShortlistTokenService.deactivate_token(token_id=token_id)
            return status.HTTP_200_OK

    def add_websocket_route(self):
        @self.router.websocket("/ws/{token}/")
        async def shortlist_ws(websocket: WebSocket, token: str):
            """
            WebSocket для real-time обновлений шорт-листа.
            Клиент подключается и получает push при изменениях.
            """
            await websocket.accept()
            last_data = None

            try:
                while True:
                    # Получаем актуальные данные
                    view_data = await ShortlistTokenService.get_shortlist_view(token=token)
                    if view_data is None:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Token expired or invalid",
                        })
                        break

                    # Отправляем, только если данные изменились
                    data_str = json.dumps(view_data, default=str, sort_keys=True)
                    if data_str != last_data:
                        await websocket.send_json({
                            "type": "update",
                            "data": view_data,
                        })
                        last_data = data_str

                    # Полинг каждые 5 секунд (в рамках TTL 60s кеша)
                    await asyncio.sleep(5)

            except WebSocketDisconnect:
                pass
            except Exception:
                await websocket.close()


