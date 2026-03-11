"""
SSOT Shortlist Routes — динамические шорт-листы.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from typing import Optional, Dict, Any, List
from users.dependencies.auth_depends import admin_authorized
from users.services.auth_token.types.jwt import JWT
from shortlists.service import ShortlistTokenService, ShortlistCacheService
from shortlists.schemas import (
    SShortlistTokenCreate,
    SShortlistTokenResponse,
    SShortlistViewResponse,
)
from rbac.decorators import require_permission
from rbac.permissions import Permission
import asyncio
import json


class ShortlistRouter:
    def __init__(self):
        self.router = APIRouter(tags=["shortlists"], prefix="/shortlists")
        self.include_routers()

    def include_routers(self) -> None:
        self.add_create_token_route()
        self.add_get_view_route()
        self.add_deactivate_token_route()
        self.add_websocket_route()

    def add_create_token_route(self):
        @self.router.post("/tokens/", response_model=SShortlistTokenResponse)
        async def create_shortlist_token(
            data: SShortlistTokenCreate,
            authorized: JWT = Depends(admin_authorized),
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
        @self.router.get("/view/{token}/", response_model=SShortlistViewResponse)
        async def get_shortlist_view(
            token: str,
        ) -> SShortlistViewResponse:
            """
            Получить актуальное представление шорт-листа по токену (SSOT).
            Данные всегда актуальны — кеш TTL 60s.
            """
            view_data = await ShortlistTokenService.get_shortlist_view(token=token)
            if not view_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"message": "Shortlist not found or token expired"},
                )
            return SShortlistViewResponse(**view_data)

    def add_deactivate_token_route(self):
        @self.router.delete("/tokens/{token_id}/")
        async def deactivate_token(
            token_id: int,
            authorized: JWT = Depends(admin_authorized),
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


