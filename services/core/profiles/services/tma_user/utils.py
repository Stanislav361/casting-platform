from profiles.schemas.tma_user import SImageCoordinate, SImageCoordinatePartial, SFields
from profiles.services.tma_user.exceptions import (
    ImageConditionExc,
    FieldsEmptyExc,
    CastingIsNotExisting,
    CastingIsClosed,
)
from users.services.authorization.utils import check_parent_permissions_on_child
from users.services.auth_token.types.jwt import JWT
from sqlalchemy.ext.asyncio import AsyncSession
from profiles.models import ProfileImages
from profiles.repositories.types.tma_user import TmaProfileRepository
from sqlalchemy import select, and_
from castings.models import Casting
from castings.enums import CastingStatusEnum
from profiles.enums import ImageType


def get_coordinate_model(x1, y1, x2, y2) -> SImageCoordinate:
    top_left = SImageCoordinatePartial(x=x1, y=y1)
    bottom_right = SImageCoordinatePartial(x=x2, y=y2)
    return SImageCoordinate(
        top_left=top_left,
        bottom_right=bottom_right,
    )


async def check_image_permissions(session: AsyncSession, token: JWT, child_id: int) -> None:
    await check_parent_permissions_on_child(
        session=session,
        parent_id=int(token.profile_id),
        child_model=ProfileImages,
        child_id=child_id,
    )

async def check_profile_fields(session: AsyncSession, token: JWT, ) -> None:

    profile = await TmaProfileRepository.get_profile(session=session, profile_id=int(token.profile_id))
    profile_fields = SFields.model_validate(profile)
    empty_fields = [
        field
        for field, info in profile_fields.model_fields.items()
        if not getattr(profile_fields, field)
    ]
    if empty_fields:
        raise FieldsEmptyExc(empty_fields=empty_fields)

    required_image_types = {
        ImageType.portrait: False,
        ImageType.side_profile: False,
        ImageType.full_body: False
    }
    for image in profile.images:
        required_image_types[image.image_type] = True

    if not all(required_image_types.values()):
        raise ImageConditionExc(required_fields=[k for k, v in required_image_types.items() if not v])


async def check_casting_for_response(session: AsyncSession, casting_id: int, ):
    stmt = select(Casting).filter_by(id=casting_id)
    casting = (await session.execute(stmt)).unique().scalar_one_or_none()
    if not casting:
        raise CastingIsNotExisting
    if not casting.status == CastingStatusEnum.published:
        raise CastingIsNotExisting
    if casting.status == CastingStatusEnum.closed:
        raise CastingIsClosed
