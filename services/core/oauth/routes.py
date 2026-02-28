"""
OAuth Routes — мультипровайдерная авторизация.
GET  /auth/oauth/{provider}/url     — получить URL для редиректа
POST /auth/oauth/{provider}/callback — обработать callback
POST /auth/oauth/telegram/verify    — прямая верификация Telegram данных
GET  /auth/oauth/providers           — список привязанных провайдеров
"""
import secrets
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends, Response, Request
from pydantic import BaseModel

from oauth.providers import PROVIDERS, TelegramOAuthProvider
from oauth.service import OAuthService
from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import tma_authorized
from config import settings


class OAuthURLRequest(BaseModel):
    redirect_uri: str


class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: str
    state: Optional[str] = None


class TelegramAuthRequest(BaseModel):
    id: int
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class OAuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    provider: str


class OAuthRouter:
    def __init__(self):
        self.router = APIRouter(prefix="/auth/oauth", tags=["oauth"])
        self._include_routes()

    def _include_routes(self):
        self._add_get_auth_url()
        self._add_callback()
        self._add_telegram_verify()
        self._add_providers_list()

    def _add_get_auth_url(self):
        @self.router.post("/{provider}/url/", response_model=dict)
        async def get_oauth_url(
            provider: str,
            data: OAuthURLRequest,
        ) -> dict:
            """Получить URL для OAuth-редиректа на провайдера."""
            if provider not in PROVIDERS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unknown provider: {provider}. Available: {list(PROVIDERS.keys())}",
                )
            state = secrets.token_urlsafe(32)
            oauth_provider = PROVIDERS[provider]()
            url = oauth_provider.get_authorize_url(
                redirect_uri=data.redirect_uri,
                state=state,
            )
            return {"url": url, "state": state}

    def _add_callback(self):
        @self.router.post("/{provider}/callback/", response_model=OAuthTokenResponse)
        async def oauth_callback(
            provider: str,
            data: OAuthCallbackRequest,
        ) -> OAuthTokenResponse:
            """Обменять OAuth code на JWT-токен нашего приложения."""
            if provider not in PROVIDERS:
                raise HTTPException(status_code=400, detail=f"Unknown provider: {provider}")

            try:
                oauth_provider = PROVIDERS[provider]()
                oauth_user = await oauth_provider.exchange_code(
                    code=data.code,
                    redirect_uri=data.redirect_uri,
                )
            except Exception as e:
                raise HTTPException(status_code=401, detail=f"OAuth failed: {str(e)}")

            jwt_token = await OAuthService.authenticate_or_create(oauth_data=oauth_user)
            return OAuthTokenResponse(
                access_token=str(jwt_token),
                provider=provider,
            )

    def _add_telegram_verify(self):
        @self.router.post("/telegram/verify/", response_model=OAuthTokenResponse)
        async def telegram_verify(data: TelegramAuthRequest) -> OAuthTokenResponse:
            """
            Прямая верификация данных Telegram Login Widget.
            Для случаев когда Telegram передаёт данные напрямую (не через code).
            """
            auth_dict = data.model_dump()

            from oauth.providers import OAuthUserData
            import json as _json

            if settings.MODE in ['LOCAL', 'DEV']:
                user_data = OAuthUserData(
                    provider='telegram',
                    provider_user_id=str(data.id),
                    first_name=data.first_name,
                    last_name=data.last_name,
                    username=data.username,
                    email=None,
                    avatar_url=data.photo_url,
                    raw_data=_json.dumps(auth_dict),
                )
            else:
                try:
                    user_data = TelegramOAuthProvider.verify_auth_data(auth_dict)
                except ValueError as e:
                    raise HTTPException(status_code=401, detail=str(e))
            jwt_token = await OAuthService.authenticate_or_create(oauth_data=user_data)
            return OAuthTokenResponse(
                access_token=str(jwt_token),
                provider="telegram",
            )

    def _add_providers_list(self):
        @self.router.get("/providers/", response_model=list)
        async def get_my_providers(
            authorized: JWT = Depends(tma_authorized),
        ) -> list:
            """Список привязанных OAuth-провайдеров текущего пользователя."""
            return await OAuthService.get_user_providers(user_id=int(authorized.id))
