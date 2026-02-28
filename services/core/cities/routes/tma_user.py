from fastapi import APIRouter, Depends, Query
from users.services.auth_token.types.jwt import JWT
from cities.service import CitiesService
from cities.schemas import SCitiesList
from users.dependencies.auth_depends import tma_authorized

class TmaCitiesRouter:

    def __init__(self):
        self.router = APIRouter(tags=["tma & cities"], prefix="/cities")
        self.include_routers()

    def include_routers(self) -> None:
        self.add_get_profile_route()

    def add_get_profile_route(self, ):
        @self.router.get('/')
        async def search(
            search: str = Query(None, ), # noqa
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
            authorized: JWT = Depends(tma_authorized),
        ) -> SCitiesList:

            return await CitiesService.search(
                search=search,
                page_size=page_size,
                page_number=page_number,
            )