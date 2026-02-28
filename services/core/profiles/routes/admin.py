from fastapi import APIRouter, Depends, Query
from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import admin_authorized
from profiles.services.admin.service import AdminActorService
from profiles.schemas.admin import *


class AdminActorRouter:

    def __init__(self):
        self.router = APIRouter(tags=["admin & actors"], prefix="/actors")
        self.include_routers()

    def include_routers(self) -> None:
        self.add_get_all_actors_route()
        self.add_get_actor_route()
        self.add_get_actor_responses()

    def add_get_all_actors_route(self, ):
        @self.router.get('/')
        async def get_all_actors(
            search: Optional[str]=Query(None),
            filters: SActorFilters = Depends(),
            sort_by: SActorSorts = Depends(),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
            authorized: JWT = Depends(admin_authorized),
        ) -> SActorList:
            return await AdminActorService.get_all_actors(
                search=search,
                filters=filters,
                sort_by=sort_by,
                page_size=page_size,
                page_number=page_number,
            )

    def add_get_actor_route(self, ):
        @self.router.get("/{actor_id}/")
        async def get_actor(
            actor_id: int,
            authorized: JWT = Depends(admin_authorized),
        ) -> SActorData:
            return await AdminActorService.get_actor(actor_id=actor_id)

    def add_get_actor_responses(self, ):
        @self.router.get("/responses/{actor_id}/")
        async def get_actor_responses(
            actor_id: int,
            filters: SResponsesFilters = Depends(),
            sort_by: SResponsesSorts = Depends(),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
            authorized: JWT = Depends(admin_authorized),
        ) -> SResponsesList:
            return await AdminActorService.get_responses(
                actor_id=actor_id,
                filters=filters,
                sort_by=sort_by,
                page_size=page_size,
                page_number=page_number
            )
