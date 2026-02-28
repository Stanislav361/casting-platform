from sqlalchemy.ext.asyncio.session import AsyncSession
from profiles.repositories.types.admin import AdminActorRepository
from users.repositories.types.admin import AdminUserRepository
from postgres.database import transaction
from users.services.auth_token.types.jwt import JWT
from users.schemas.admin import *
from fastapi import status
from users.enums import ModelRoles


class AdminService:

    @staticmethod
    async def ger_current_user(user_token: JWT) -> CurrentAdminData:
        user = await AdminUserRepository.get_current_user(user_id=int(user_token.id))
        return CurrentAdminData.model_validate(user)

    @staticmethod
    @transaction
    async def get_user_list(
            session: AsyncSession,
            filters: SUserFilters,
            page_size: int,
            page_number: int,
            search: Optional[str] = None
    ) -> SUserList:
        users, query = await AdminUserRepository.get_user_list(
            session=session,
            search=search,
            filters=filters,
            page_size=page_size,
            page_number=page_number
        )
        response = [SUserListPartial.model_validate(user) for user in users]
        meta = await AdminActorRepository.get_meta(
            session=session,
            query=query,
            page_size=page_size,
            page_number=page_number
        )
        return SUserList(meta=meta, response=response)

    @staticmethod
    async def set_user_roles(user_id: int, role: ModelRoles) -> int:
        await AdminUserRepository.set_user_roles(user_id=user_id, role=role)
        return status.HTTP_200_OK
