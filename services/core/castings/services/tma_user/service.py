from castings.enums import CastingStatusEnum
from postgres.database import transaction
from castings.schemas.tma_user import SCastingData
from castings.services.tma_user.exceptions import CastingIdIsNotFound
from reports.repositories.types.admin import responses
from users.services.auth_token.types.jwt import JWT
from castings.repositories.types.tma_user import TmaCastingRepository
from castings.schemas.tma_user import SProfileResponse


class TmaCastingService:

    @classmethod
    @transaction
    async def get_casting(cls, session, user_token: JWT, casting_id) -> SCastingData:
        try:
            casting = await TmaCastingRepository.get_casting(session=session, casting_id=casting_id)
            if casting.status != CastingStatusEnum.published:
                raise CastingIdIsNotFound
            casting = SCastingData.model_validate(casting)
            casting.has_applied = await TmaCastingRepository.has_applied(
                session=session,
                casting_id=casting_id,
                profile_id=user_token.profile_id
            )
            return casting
        except CastingIdIsNotFound as err:
            raise err.API_ERR


    @classmethod
    @transaction
    async def get_response(cls, session, user_token: JWT, casting_id: int) -> SProfileResponse:
        response = await TmaCastingRepository.get_response(
            session=session,
            profile_id=int(user_token.profile_id),
            casting_id=casting_id
        )
        print(response)

        return SProfileResponse.model_validate(response)
