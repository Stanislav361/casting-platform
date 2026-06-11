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
from users.models import User, UserOAuthProvider, ActorProfile
from users.enums import ModelRoles
from users.services.auth_token.service import TokenService
from users.services.auth_token.types.jwt import JWT
from oauth.providers import OAuthUserData
from config import settings


class OAuthService:

    @staticmethod
    async def authenticate_or_create(
        oauth_data: OAuthUserData,
        link_to_user_id: Optional[int] = None,
        response=None,
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
                user = await OAuthService._find_user_by_provider_identity(session, oauth_data)
                if user:
                    await OAuthService._sync_user_from_provider(session, user, oauth_data)
                    await OAuthService._create_provider_link(session, user.id, oauth_data)
                else:
                    user = await OAuthService._create_user(session, oauth_data)
                    await OAuthService._create_provider_link(session, user.id, oauth_data)

            # Considering session expires attributes on commit (default behavior),
            # capture every value we need BEFORE the commit so we never trigger
            # a sync lazy-load in async context (greenlet_spawn error).
            user_id_value = user.id
            role_value = user.role.value if hasattr(user.role, 'value') else str(user.role)

            profile_id_result = await session.execute(
                select(ActorProfile.id)
                .where(
                    ActorProfile.user_id == user_id_value,
                    ActorProfile.is_deleted == False,  # noqa: E712
                )
                .order_by(ActorProfile.created_at.asc())
                .limit(1)
            )
            profile_id_value = profile_id_result.scalar_one_or_none() or 0

            await session.commit()

            if response is not None:
                TokenService.set_refresh_token(
                    response=response,
                    user_id=str(user_id_value),
                    role=role_value,
                    profile_id=str(profile_id_value),
                    container=settings.REFRESH_WEB_TOKEN_CONTAINER_NAME,
                )

            return TokenService.generate_access_token(
                user_id=str(user_id_value),
                profile_id=str(profile_id_value),
                role=role_value,
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
    async def _find_user_by_provider_identity(
        session: AsyncSession, oauth_data: OAuthUserData
    ) -> Optional[User]:
        if oauth_data.provider == "telegram" and oauth_data.provider_user_id:
            result = await session.execute(
                select(User).where(
                    User.telegram_id == int(oauth_data.provider_user_id),
                    User.is_deleted == False,
                )
            )
            user = result.scalar_one_or_none()
            if user:
                return user

        return await OAuthService._find_user_by_email(session, oauth_data.email)

    @staticmethod
    async def _sync_user_from_provider(
        session: AsyncSession, user: User, oauth_data: OAuthUserData
    ) -> None:
        if oauth_data.provider == "telegram":
            user.telegram_id = int(oauth_data.provider_user_id)
            if oauth_data.username:
                user.telegram_username = oauth_data.username

        if oauth_data.first_name and not user.first_name:
            user.first_name = oauth_data.first_name
        if oauth_data.last_name and not user.last_name:
            user.last_name = oauth_data.last_name
        if oauth_data.avatar_url and not user.photo_url:
            user.photo_url = oauth_data.avatar_url

        session.add(user)

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
