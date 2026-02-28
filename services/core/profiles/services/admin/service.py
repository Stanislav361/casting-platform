from postgres.database import transaction
from profiles.repositories.types.admin import AdminActorRepository
from profiles.schemas.admin import *
from profiles.services.admin.exceptions import ProfileIdIsNotFound
from shared.schemas.base import SListMeta

class AdminActorService:

    @classmethod
    @transaction
    async def get_actor(cls, session, actor_id: int) -> SActorData:
        actor = await AdminActorRepository.get_actor(
            session=session, actor_id=actor_id
        )
        if not actor:
            raise ProfileIdIsNotFound().API_ERR
        return SActorData.model_validate(actor)

    @classmethod
    @transaction
    async def get_all_actors(
            cls,
            session,
            filters: SActorFilters,
            sort_by: SActorSorts,
            page_size: int,
            page_number: int,
            search: Optional[str]=None,
    ) -> SActorList:

        actors, query = await AdminActorRepository.get_actor_list(
            session=session,
            search=search,
            filters=filters,
            sort_criteria=sort_by,
            page_size=page_size,
            page_number=page_number
        )
        meta = await AdminActorRepository.get_meta(
            session=session,
            query=query,
            page_number=page_number,
            page_size=page_size,
        )
        return SActorList(meta=meta, response=actors)

    @classmethod
    @transaction
    async def get_responses(
        cls,
        session,
        actor_id: int,
        filters: SResponsesFilters,
        sort_by: SResponsesSorts,
        page_size: int,
        page_number: int,
    ) -> SResponsesList:

        actors, query = await AdminActorRepository.get_responses_list(
            session=session,
            profile_id=actor_id,
            filters=filters,
            sort_criteria=sort_by,
            page_size=page_size,
            page_number=page_number
        )

        meta = await AdminActorRepository.get_meta(
            session=session,
            query=query,
            page_number=page_number,
            page_size=page_size,
        )
        return SResponsesList(meta=meta, response=actors)
