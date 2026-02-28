from typing import Union, Tuple

from fastapi import APIRouter, Depends, UploadFile, Form
from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import tma_authorized
from profiles.schemas.tma_user import SProfileUpdate, SProfileData, SProfileResponsePost
from profiles.services.tma_user.service import TmaProfileService
from profiles.enums import ImageType


class TmaProfileRouter:

    def __init__(self):
        self.router = APIRouter(tags=["tma & profile"], prefix="/profile")
        self.include_routers()

    def include_routers(self) -> None:
        self.add_get_profile_route()
        self.add_edit_profile_route()
        self.add_add_actor_response_route()
        # self.add_update_actor_response_route()
        self.add_add_image_route()
        self.add_delete_image()

    def add_get_profile_route(self, ):
        @self.router.get("/")
        async def get_profile(
            authorized: JWT = Depends(tma_authorized),
        ) -> SProfileData:
            return await TmaProfileService.get_profile(user_token=authorized)

    def add_edit_profile_route(self, ):
        @self.router.patch("/edit/")
        async def edit_profile(
            profile_data: SProfileUpdate,
            authorized: JWT = Depends(tma_authorized),
        ) -> int:
            return await TmaProfileService.edit_profile(profile_data=profile_data, user_token=authorized)

    def add_add_image_route(self, ):
        @self.router.post("/image/create/")
        async def add_image(
            image: UploadFile,
            image_type: ImageType = Form(..., description='image_type', ),
            x1: Union[int, float] = Form(..., description='top_left'),
            y1: Union[int, float] = Form(..., description='top_left'),
            x2: Union[int, float] = Form(..., description='bottom_right'),
            y2: Union[int, float] = Form(..., description='bottom_right'),
            authorized: JWT = Depends(tma_authorized),
        ) -> int:
            return await TmaProfileService.add_image(
                user_token=authorized,
                image=image,
                image_type=image_type,
                x1=x1,
                y1=y1,
                x2=x2,
                y2=y2,
            )

    def add_add_actor_response_route(self):
        @self.router.post("/responses/{casting_id}/create/")
        async def add_actor_response(
            response: SProfileResponsePost,
            authorized: JWT = Depends(tma_authorized),
        ) -> int:
            return await TmaProfileService.add_response(
                response=response,
                user_token=authorized
            )

    # def add_update_actor_response_route(self):
    #     @self.router.patch("/responses/{casting_id}/edit/")
    #     async def add_actor_response(
    #         response: SProfileResponsePost,
    #         authorized: JWT = Depends(tma_authorized),
    #     ) -> int:
    #         return await TmaProfileService.update_response(
    #             response=response,
    #             user_token=authorized
    #         )

    def add_delete_image(self):
        @self.router.delete("/image/{image_id}/delete/")
        async def add_actor_response(
            image_id: int,
            authorized: JWT = Depends(tma_authorized),
        ) -> int:
            return await TmaProfileService.delete_image(user_token=authorized,image_id=image_id)
