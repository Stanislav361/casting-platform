from fastapi import APIRouter, HTTPException, Response, Request, Depends, status
# from src.routers.config import endpoint_config
from config import settings, tma_auth_flags, admin_auth_flags
from users.dependencies.auth_depends import *
from users.services.authentication.service import AuthenticateUserService
from users.schemas.auth import SAdminAuthData, STmaAuthData
from users.dependencies.auth_depends import admin_authorized
from users.repositories.types.admin import AdminUserRepository
from users.repositories.types.tma import TmaUserRepository
from typing import Literal
from users.services.auth_token.types.jwt import JWT


class TmaAuthRouter:
    def __init__(self):
        self.router = APIRouter(prefix="/auth", tags=["tma & auth"],)
        self.include_routers()

    def include_routers(self):
        if settings.MODE in ['DEV', 'LOCAL']:
            self.authenticate_predicate()
        self.add_authentication_route()
        self.add_refresh_access_token_route()

    def authenticate_predicate(self):
        @self.router.post("/predicate/")
        async def authentication_predicate(
                predicate: bool,
        ) -> int:
            await TmaUserRepository.set_auth_predicate(predicate=predicate)
            return status.HTTP_200_OK

    def add_authentication_route(self):
        @self.router.post("/")
        async def authentication(
                auth_data: STmaAuthData,
                auth_method=Depends(get_tma_authentication_method),
        ) -> str:
            token = await AuthenticateUserService(
                authenticate_method=auth_method
            ).authenticate_user(auth_data=auth_data)
            return str(token)

    def add_refresh_access_token_route(self):
        @self.router.post("/refresh-token/")
        async def refresh_token(
            auth_method=Depends(get_tma_authentication_method),
        ) -> str:
            token = await AuthenticateUserService(
                authenticate_method=auth_method
            ).refresh_access_token()
            return str(token)


class AdminAuthRouter:

    def __init__(self):
        self.router = APIRouter(prefix="/auth", tags=["admin & auth"],)
        self.include_routers()

    def include_routers(self):
        if settings.MODE in ['DEV', 'LOCAL']:
            self.authenticate_predicate()
        self.add_authentication_route()
        self.add_refresh_access_token_route()

    def authenticate_predicate(self):
        @self.router.post("/predicate/")
        async def authentication_predicate(
                predicate: bool,
        ) -> int:
            await AdminUserRepository.set_auth_predicate(predicate=predicate)
            return status.HTTP_200_OK

    def add_authentication_route(self):
        @self.router.post("/")
        async def authentication(
                auth_data: SAdminAuthData,
                auth_method= Depends(get_admin_authentication_method),

        ) -> str:
            token = await AuthenticateUserService(
                authenticate_method=auth_method
            ).authenticate_user(auth_data=auth_data)
            from log.base import logger
            logger.debug(msg=f'success authentication', extra={'token': token})
            return str(token)

    def add_refresh_access_token_route(self):
        @self.router.get("/refresh/")
        async def refresh_token(
            auth_method=Depends(get_admin_authentication_method),
        ):
            token = await AuthenticateUserService(
                authenticate_method=auth_method
            ).refresh_access_token()
            return str(token)


    # def add_logout_route(self):
    #     @self.router.post("/logout/")
    #     async def logout(
    #             response: Response,
    #             authorized: JWT = Depends(admin_authorized),
    #     ):
    #         pass