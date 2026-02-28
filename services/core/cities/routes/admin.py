from fastapi import APIRouter, Depends, Query
from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import admin_authorized
from cities.service import CitiesService
from cities.schemas import SCitiesList
from typing import Optional

class AdminCitiesRouter:

    def __init__(self):
        self.router = APIRouter(tags=["admin & cities"], prefix="/cities")
        self.include_routers()

    def include_routers(self) -> None:
        self.add_search_route()

    def add_search_route(self, ):
        @self.router.get('/')
        async def search_route(
            search: Optional[str] = Query(None),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
            # authorized: JWT = Depends(admin_authorized),
        ) -> SCitiesList:

            return await CitiesService.search(
                search=search,
                page_size=page_size,
                page_number=page_number,
            )
