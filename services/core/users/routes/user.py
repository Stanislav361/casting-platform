from fastapi import APIRouter, HTTPException, Response, Request, Depends, status, Query
# from src.routers.config import endpoint_config
from users.dependencies.auth_depends import admin_authorized
from users.schemas.admin import *
from users.services.auth_token.types.jwt import JWT
from users.services.admin.service import AdminService
from users.enums import ModelRoles


class TMARouter:
    pass


class AdminRouter:
    def __init__(self):
        self.router = APIRouter(tags=["admin"], )
        self.include_routers()

    def include_routers(self):
        self.add_get_admins_list()
        self.add_get_current_user_route()
        self.add_set_user_roles_route()

    def add_get_current_user_route(self):
        @self.router.get('/users/current/')
        async def get_current_user(
            authorized: JWT = Depends(admin_authorized),
        ) -> CurrentAdminData:
            return await AdminService.ger_current_user(user_token=authorized)

    def add_get_admins_list(self):
        @self.router.get('/users/')
        async def get_user_list(
            authorized: JWT = Depends(admin_authorized),
            search: Optional[str] = Query(None),
            filters: SUserFilters = Depends(), # todo добавить фильтры по ролям
            page_size: int = Query(..., gt=0),
            page_number: int = Query(..., gt=0),
        ) -> SUserList:
            return await AdminService.get_user_list(
                search=search,
                filters=filters,
                page_size=page_size,
                page_number=page_number
            )

    def add_set_user_roles_route(self):
        @self.router.patch('/users/{user_id}/roles/')
        async def set_user_roles(
            user_id: int,
            role: ModelRoles,
            authorized: JWT = Depends(admin_authorized),
        ) -> int:
            return await AdminService.set_user_roles(user_id=user_id, role=role)
