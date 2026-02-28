from fastapi import APIRouter, Depends, UploadFile, Query, Form
from fastapi.responses import JSONResponse
from castings.schemas.admin import *
# from src.routers.config import endpoint_config
from users.dependencies.auth_depends import admin_authorized
from users.schemas.admin import *
from users.services.auth_token.types.jwt import JWT
from castings.services.admin.service import AdminCastingService


class AdminCastingRouter:
    def __init__(self):
        self.router = APIRouter(tags=["admin & casting"], prefix='/castings')
        self.include_routers()

    def include_routers(self ) -> None:
        self.add_get_all_casting_route()
        self.add_get_casting_route()
        self.add_get_responses_route()
        self.add_create_casting_route()
        self.add_add_image_for_casting()
        self.add_publish_casting_route()
        self.add_unpublish_casting_route()
        self.add_close_casting_route()
        self.add_edit_casting_route()
        self.add_delete_casting_route()
        self.add_delete_casting_image_route()

    def add_get_all_casting_route(self, ):
        @self.router.get('/')
        async def get_all_castings(
            authorized: JWT = Depends(admin_authorized),
            search: Optional[str] = Query(default=None,),
            filters: SCastingFilters = Depends(),
            sort_by: SCastingSorts = Depends(),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
        ) -> SCastingList:
            return await AdminCastingService.get_all_castings(
                search=search,
                filters=filters,
                sort_by=sort_by,
                page_size=page_size,
                page_number=page_number
            )

    def add_get_casting_route(self, ):
        @self.router.get("/{casting_id}/")
        async def get_casting(
            casting_id: int,
            authorized: JWT = Depends(admin_authorized),
        ) -> SCastingData:
            return await AdminCastingService.get_casting(casting_id=casting_id)

    def add_get_responses_route(self, ):
        @self.router.get('/responses/{casting_id}/')
        async def get_casting_responses(
            casting_id: int,
            search: Optional[str] = Query(default=None,),
            filters: SResponseFilters = Depends(),
            sort_by: SResponseSorts = Depends(),
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
            authorized: JWT = Depends(admin_authorized),
        ) -> SResponseList:
            return await AdminCastingService.get_responses(
                search=search,
                casting_id=casting_id,
                filters=filters,
                sort_by=sort_by,
                page_size=page_size,
                page_number=page_number,
            )

    def add_create_casting_route(self, ):
        @self.router.post('/create/')
        async def create_casting(
            image: Optional[UploadFile]=None,
            title: str = Form(..., min_length=1, max_length=100),
            description: str = Form(..., min_length=1, max_length=10**4),
            authorized: JWT = Depends(admin_authorized),
        ) -> JSONResponse:
            return await AdminCastingService.create_casting(
                title=title,
                description=description,
                image=image
            )
    def add_edit_casting_route(self, ):
        @self.router.post('/{casting_id}/edit/')
        async def edit_casting(
            casting_id: int,
            image: Optional[UploadFile]=None,
            title: str = Form(..., min_length=1, max_length=100),
            description: str = Form(..., min_length=1, max_length=10**4),
            authorized: JWT = Depends(admin_authorized),
        ) -> JSONResponse:

            return await AdminCastingService.edit_casting(
                casting_id=casting_id,
                image=image,
                title=title,
                description=description,
            )

    def add_add_image_for_casting(self, ):
        @self.router.post('/image/{casting_id}/create/')
        async def add_image(
            casting_id: int,
            image: UploadFile,
            authorized: JWT = Depends(admin_authorized),
        ) -> JSONResponse:
            return await AdminCastingService.add_image(casting_id=casting_id, image=image)

    def add_publish_casting_route(self, ):
        @self.router.patch('/{casting_id}/publish/')
        async def publish_casting(
                casting_id: int,
                authorized: JWT = Depends(admin_authorized),
        ) -> JSONResponse:
            return await AdminCastingService.publish_casting(casting_id=casting_id)

    def add_unpublish_casting_route(self, ):
        @self.router.patch('/{casting_id}/unpublish/')
        async def unpublish_casting(
                casting_id: int,
                authorized: JWT = Depends(admin_authorized),
        ) -> JSONResponse:
            return await AdminCastingService.unpublish_casting(casting_id=casting_id)

    def add_close_casting_route(self, ):
        @self.router.patch('/{casting_id}/close/')
        async def close_casting(
                casting_id: int,
                authorized: JWT = Depends(admin_authorized),
        ):
            return await AdminCastingService.close_casting(casting_id=casting_id)

    def add_delete_casting_route(self, ):
        @self.router.delete('/{casting_id}/delete/')
        async def delete_casting(
                casting_id: int,
                authorized: JWT = Depends(admin_authorized),
        ) -> JSONResponse:
            return await AdminCastingService.delete_casting(casting_id=casting_id, )

    def add_delete_casting_image_route(self, ):
        @self.router.delete('/image/{image_id}/delete/')
        async def delete_casting_image(
                image_id: int,
                authorized: JWT = Depends(admin_authorized),
        )-> JSONResponse:
            return await AdminCastingService.delete_image(image_id=image_id)
