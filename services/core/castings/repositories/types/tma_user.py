from shared.repository.base.repository import BaseRepository
from castings.models import Casting, CastingImage
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from castings.services.tma_user.exceptions import CastingIdIsNotFound
from profiles.models import Response

class TmaCastingRepository(BaseRepository):
    model = Casting
    image_model = CastingImage


    @classmethod
    async def get_casting(cls, session: AsyncSession, casting_id) -> Casting:
        query = select(cls.model).filter_by(id=casting_id)
        casting = (await session.execute(query)).unique().scalar_one_or_none()
        if not casting:
            raise CastingIdIsNotFound
        return casting

    @classmethod
    async def has_applied(cls, session: AsyncSession, casting_id, profile_id) -> bool:
        query = select(Response).filter_by(casting_id=casting_id, profile_id=int(profile_id))
        response = (await session.execute(query)).unique().scalar_one_or_none()
        return bool(response)


    @classmethod
    async def get_response(
            cls,
            session: AsyncSession,
            profile_id: int,
            casting_id: int,
    ) -> type(Response):
        stmt_get = select(Response).filter_by(casting_id=casting_id, profile_id=profile_id)
        instance = (await session.execute(stmt_get)).unique().scalar_one_or_none()
        if not instance:
            return {"video_intro": None}
        return instance
