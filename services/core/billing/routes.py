"""
Season 03: Billing Routes.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import tma_authorized, employer_authorized, admin_authorized
from billing.service import BillingService, SearchService, DataIsolationService
from security.rate_limit import rate_limit_dependency


class BillingRouter:
    def __init__(self):
        self.router = APIRouter(tags=["billing"], prefix="/billing")
        self._include()

    def _include(self):
        @self.router.get("/plans/")
        async def get_plans():
            """Список доступных тарифных планов."""
            return await BillingService.get_plans()

        @self.router.post("/subscribe/")
        async def subscribe(
            plan_code: str = Query(..., description="basic or pro"),
            months: int = Query(1, gt=0),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Оформить подписку."""
            return await BillingService.subscribe(
                user_id=int(authorized.id), plan_code=plan_code, months=months
            )

        @self.router.get("/my/")
        async def get_my_subscription(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Текущая подписка пользователя."""
            sub = await BillingService.get_user_subscription(user_id=int(authorized.id))
            if not sub:
                return {"plan_code": None, "status": "none", "message": "No subscription"}
            return sub

        @self.router.post("/cron/check-expired/")
        async def cron_check_expired(
            authorized: JWT = Depends(admin_authorized),
        ):
            """Cron: проверка и деактивация истёкших подписок (Grace 24h)."""
            return await BillingService.check_and_deactivate_expired()


class SearchRouter:
    def __init__(self):
        self.router = APIRouter(tags=["search"], prefix="/search")
        self._include()

    def _include(self):
        @self.router.get("/project/{casting_id}/")
        async def search_respondents(
            casting_id: int,
            q: str = Query(None),
            page: int = Query(1, gt=0),
            page_size: int = Query(20, gt=0),
            _: None = Depends(rate_limit_dependency),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Basic: поиск среди откликнувшихся на проект (JOIN с откликами)."""
            return await SearchService.search_respondents(
                casting_id=casting_id, query=q, page=page, page_size=page_size
            )

        @self.router.get("/global/")
        async def search_global(
            q: str = Query(..., min_length=2),
            page: int = Query(1, gt=0),
            page_size: int = Query(20, gt=0),
            _: None = Depends(rate_limit_dependency),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Pro: полнотекстовый поиск по всей базе (только АдминПРО)."""
            if authorized.role not in ['employer_pro', 'owner', 'administrator', 'manager']:
                raise HTTPException(
                    status_code=403,
                    detail="Global search requires AdminPro subscription"
                )
            return await SearchService.search_global(
                query=q, page=page, page_size=page_size
            )

        @self.router.get("/actor/{profile_id}/")
        async def get_public_actor(
            profile_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Публичный профиль актёра (Data Isolation — без internal полей)."""
            return await DataIsolationService.get_public_actor_profile(profile_id)
