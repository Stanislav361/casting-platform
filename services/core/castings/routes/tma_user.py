from fastapi import APIRouter, Depends
from users.dependencies.auth_depends import tma_authorized
from castings.schemas.tma_user import SProfileResponse
from users.services.auth_token.types.jwt import JWT
from castings.services.tma_user.service import TmaCastingService
from castings.schemas.tma_user import SCastingData

class TmaCastingRouter:
    def __init__(self):
        self.router = APIRouter(tags=["tma & casting"], prefix='/castings')
        self.include_routers()
        self.add_get_response()

    def include_routers(self ) -> None:
        self.add_get_casting_route()


    def add_get_casting_route(self, ):
        @self.router.get("/{casting_id}/")
        async def get_casting(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
        ) -> SCastingData:
            return await TmaCastingService.get_casting(user_token=authorized, casting_id=casting_id)

    def add_get_response(self, ):
        @self.router.get("/responses/{casting_id}/")
        async def get_response(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
        ) -> SProfileResponse:
            return await TmaCastingService.get_response(
                casting_id=casting_id,
                user_token=authorized
            )
