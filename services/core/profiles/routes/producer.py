from fastapi import APIRouter
from profiles.services.admin.service import AdminActorService
from profiles.schemas.producer import *


class ProducerActorRouter:

    def __init__(self):
        self.router = APIRouter(tags=["producer & actors"], prefix="/actors")
        self.include_routers()

    def include_routers(self) -> None:
        self.add_get_actor_route()

    def add_get_actor_route(self, ):
        @self.router.get("/{actor_id}/")
        async def get_actor(
            actor_id: int,
        ) -> SActorData:
            return await AdminActorService.get_actor(actor_id=actor_id)