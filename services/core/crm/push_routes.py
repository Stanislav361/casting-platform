"""Web Push routes — subscribe / unsubscribe / vapid-key."""
from typing import Optional
from fastapi import APIRouter, Depends, Request, HTTPException
from pydantic import BaseModel, Field

from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import tma_authorized
from config import settings
from crm.push_service import PushService, is_configured, status as push_status


class _Keys(BaseModel):
    p256dh: str = Field(..., min_length=1, max_length=255)
    auth: str = Field(..., min_length=1, max_length=255)


class SubscribeIn(BaseModel):
    endpoint: str = Field(..., min_length=1, max_length=1000)
    keys: _Keys


class UnsubscribeIn(BaseModel):
    endpoint: str = Field(..., min_length=1, max_length=1000)


class PushRouter:
    def __init__(self):
        self.router = APIRouter(tags=["push"], prefix="/push")
        self._include()

    def _include(self):
        @self.router.get("/vapid-key/")
        async def get_vapid_public_key():
            """Публичный VAPID ключ для подписки на стороне браузера."""
            current_status = push_status()
            if not is_configured():
                return {"public_key": None, **current_status}
            return {
                "public_key": settings.VAPID_PUBLIC_KEY,
                **current_status,
            }

        @self.router.post("/subscribe/")
        async def subscribe(
            payload: SubscribeIn,
            request: Request,
            authorized: JWT = Depends(tma_authorized),
        ):
            if not is_configured():
                raise HTTPException(
                    status_code=503,
                    detail="Push notifications are not configured on the server",
                )
            ua = request.headers.get('user-agent')
            sub_id = await PushService.subscribe(
                user_id=int(authorized.id),
                endpoint=payload.endpoint,
                p256dh=payload.keys.p256dh,
                auth=payload.keys.auth,
                user_agent=ua,
            )
            return {"id": sub_id, "status": "ok"}

        @self.router.post("/unsubscribe/")
        async def unsubscribe(
            payload: UnsubscribeIn,
            authorized: JWT = Depends(tma_authorized),
        ):
            await PushService.unsubscribe(
                user_id=int(authorized.id),
                endpoint=payload.endpoint,
            )
            return {"status": "ok"}
