"""
OAuth Providers — Telegram OAuth Widget + VK ID (OAuth 2.0).
"""
import hashlib
import hmac
import time
import json
from abc import ABC, abstractmethod
from typing import Optional
from dataclasses import dataclass

import httpx
from config import settings


@dataclass
class OAuthUserData:
    provider: str
    provider_user_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    raw_data: Optional[str] = None


class BaseOAuthProvider(ABC):
    provider_name: str

    @abstractmethod
    def get_authorize_url(self, redirect_uri: str, state: str) -> str:
        ...

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> OAuthUserData:
        ...


class TelegramOAuthProvider(BaseOAuthProvider):
    """
    Telegram Login Widget OAuth.
    Uses the hash verification method from Telegram docs.
    """
    provider_name = "telegram"

    def get_authorize_url(self, redirect_uri: str, state: str) -> str:
        bot_name = settings.TG_BOT_NAME
        return (
            f"https://oauth.telegram.org/auth?bot_id={settings.TG_BOT_TOKEN.split(':')[0]}"
            f"&origin={redirect_uri}"
            f"&return_to={redirect_uri}?state={state}"
        )

    async def exchange_code(self, code: str, redirect_uri: str) -> OAuthUserData:
        """Not used for Telegram — it posts data directly."""
        raise NotImplementedError("Telegram uses direct data posting, not code exchange")

    @staticmethod
    def verify_auth_data(auth_data: dict) -> OAuthUserData:
        """
        Verify Telegram Login Widget auth data.
        https://core.telegram.org/widgets/login#checking-authorization
        """
        received_hash = auth_data.get("hash", "")
        check_items = sorted(
            f"{k}={v}" for k, v in auth_data.items()
            if k != "hash" and v is not None
        )
        check_string = "\n".join(check_items)

        secret_key = hashlib.sha256(settings.TG_BOT_TOKEN.encode()).digest()
        computed_hash = hmac.new(
            secret_key, check_string.encode(), hashlib.sha256
        ).hexdigest()

        auth_date = int(auth_data.get("auth_date", 0))
        is_fresh = (time.time() - auth_date) < 86400

        if computed_hash != received_hash or not is_fresh:
            raise ValueError("Invalid Telegram auth data")

        return OAuthUserData(
            provider="telegram",
            provider_user_id=str(auth_data["id"]),
            first_name=auth_data.get("first_name"),
            last_name=auth_data.get("last_name"),
            username=auth_data.get("username"),
            avatar_url=auth_data.get("photo_url"),
            raw_data=json.dumps(auth_data),
        )


class VKOAuthProvider(BaseOAuthProvider):
    """
    VK ID OAuth 2.0
    https://dev.vk.com/ru/api/access-token/authcode-flow-user
    """
    provider_name = "vk"

    VK_AUTHORIZE_URL = "https://id.vk.com/authorize"
    VK_TOKEN_URL = "https://id.vk.com/oauth2/auth"
    VK_USER_INFO_URL = "https://id.vk.com/oauth2/user_info"

    def __init__(self):
        self.client_id = getattr(settings, 'VK_CLIENT_ID', '')
        self.client_secret = getattr(settings, 'VK_CLIENT_SECRET', '')

    def get_authorize_url(self, redirect_uri: str, state: str) -> str:
        return (
            f"{self.VK_AUTHORIZE_URL}"
            f"?response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&state={state}"
            f"&scope=email"
            f"&code_challenge_method=plain"
            f"&code_challenge={state}"
        )

    async def exchange_code(self, code: str, redirect_uri: str) -> OAuthUserData:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                self.VK_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self.client_id,
                    "redirect_uri": redirect_uri,
                    "code_verifier": "",
                    "device_id": "web",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_data = token_resp.json()

            if "access_token" not in token_data:
                raise ValueError(f"VK token exchange failed: {token_data}")

            access_token = token_data["access_token"]

            user_resp = await client.post(
                self.VK_USER_INFO_URL,
                data={
                    "access_token": access_token,
                    "client_id": self.client_id,
                },
            )
            user_data = user_resp.json().get("user", user_resp.json())

            return OAuthUserData(
                provider="vk",
                provider_user_id=str(user_data.get("user_id", user_data.get("id", ""))),
                first_name=user_data.get("first_name"),
                last_name=user_data.get("last_name"),
                email=user_data.get("email", token_data.get("email")),
                avatar_url=user_data.get("avatar"),
                raw_data=json.dumps(user_data),
            )


PROVIDERS = {
    "telegram": TelegramOAuthProvider,
    "vk": VKOAuthProvider,
}
