"""
OAuthService — объединение аккаунтов из разных провайдеров.
Если provider_user_id уже привязан — логиним.
Если нет — создаём нового пользователя или привязываем к текущему.
"""
import json
from typing import Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from postgres.database import async_session_maker as async_session
from users.models import User, UserOAuthProvider
from users.enums import ModelRoles
from users.services.auth_token.service import TokenService
from users.services.auth_token.types.jwt import JWT
from oauth.providers import OAuthUserData


class OAuthService:

    @staticmethod
    async def authenticate_or_create(
        oauth_data: OAuthUserData,
        link_to_user_id: Optional[int] = None,
    ) -> JWT:
        """
        Main entry point for OAuth authentication.
        1. Check if provider link exists → login existing user
        2. If link_to_user_id provided → link provider to that user
        3. Otherwise → create new user + link
        """
        async with async_session() as session:
            existing_link = await OAuthService._find_provider_link(
                session, oauth_data.provider, oauth_data.provider_user_id
            )

            if existing_link:
                user = await OAuthService._get_user(session, existing_link.user_id)
                await OAuthService._update_provider_link(session, existing_link, oauth_data)
            elif link_to_user_id:
                user = await OAuthService._get_user(session, link_to_user_id)
                await OAuthService._create_provider_link(session, user.id, oauth_data)
            else:
                user = await OAuthService._find_user_by_email(session, oauth_data.email)
                if user:
                    await OAuthService._create_provider_link(session, user.id, oauth_data)
                else:
                    user = await OAuthService._create_user(session, oauth_data)
                    await OAuthService._create_provider_link(session, user.id, oauth_data)

            await session.commit()

            profile_id = 0
            if user.profiles:
                profile_id = user.profiles[0].id

            return TokenService.generate_access_token(
                user_id=str(user.id),
                profile_id=str(profile_id),
                role=user.role.value if hasattr(user.role, 'value') else str(user.role),
            )

    @staticmethod
    async def get_user_providers(user_id: int) -> list[dict]:
        async with async_session() as session:
            result = await session.execute(
                select(UserOAuthProvider).where(UserOAuthProvider.user_id == user_id)
            )
            providers = result.scalars().all()
            return [
                {
                    "provider": p.provider,
                    "provider_user_id": p.provider_user_id,
                    "provider_username": p.provider_username,
                    "connected_at": str(p.created_at),
                }
                for p in providers
            ]

    @staticmethod
    async def _find_provider_link(
        session: AsyncSession, provider: str, provider_user_id: str
    ) -> Optional[UserOAuthProvider]:
        result = await session.execute(
            select(UserOAuthProvider).where(
                and_(
                    UserOAuthProvider.provider == provider,
                    UserOAuthProvider.provider_user_id == provider_user_id,
                )
            )
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def _find_user_by_email(
        session: AsyncSession, email: Optional[str]
    ) -> Optional[User]:
        if not email:
            return None
        result = await session.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()

    @staticmethod
    async def _get_user(session: AsyncSession, user_id: int) -> User:
        result = await session.execute(
            select(User).where(User.id == user_id)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError(f"User {user_id} not found")
        return user

    @staticmethod
    async def _create_user(session: AsyncSession, oauth_data: OAuthUserData) -> User:
        user = User(
            role=ModelRoles.user,
            is_active=True,
            first_name=oauth_data.first_name,
            last_name=oauth_data.last_name,
            email=oauth_data.email,
            photo_url=oauth_data.avatar_url,
            telegram_id=int(oauth_data.provider_user_id) if oauth_data.provider == "telegram" else None,
            telegram_username=oauth_data.username if oauth_data.provider == "telegram" else None,
        )
        session.add(user)
        await session.flush()
        return user

    @staticmethod
    async def _create_provider_link(
        session: AsyncSession, user_id: int, oauth_data: OAuthUserData
    ):
        link = UserOAuthProvider(
            user_id=user_id,
            provider=oauth_data.provider,
            provider_user_id=oauth_data.provider_user_id,
            provider_username=oauth_data.username,
            provider_email=oauth_data.email,
            provider_avatar=oauth_data.avatar_url,
            raw_data=oauth_data.raw_data,
        )
        session.add(link)

    @staticmethod
    async def _update_provider_link(
        session: AsyncSession, link: UserOAuthProvider, oauth_data: OAuthUserData
    ):
        link.provider_username = oauth_data.username
        link.provider_email = oauth_data.email
        link.provider_avatar = oauth_data.avatar_url
        link.raw_data = oauth_data.raw_data
        session.add(link)
