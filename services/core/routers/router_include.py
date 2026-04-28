from fastapi import APIRouter
from users.routes.auth import AdminAuthRouter, TmaAuthRouter
from users.routes.user import AdminRouter as AdminUserRouter
from users.routes.auth_v2 import AuthV2Router
from profiles.routes.admin import AdminActorRouter
from profiles.routes.tma_user import TmaProfileRouter
from castings.routes.tma_user import TmaCastingRouter
from castings.routes.admin import AdminCastingRouter
from cities.routes.admin import AdminCitiesRouter
from cities.routes.tma_user import TmaCitiesRouter
from reports.routes.admin import AdminReportRouter
from reports.routes.producer import ProducerReportRouter
from profiles.routes.producer import ProducerActorRouter
from shortlists.routes import ShortlistRouter
from actor_profiles.routes import ActorProfileUserRouter, ActorProfileAdminRouter
from actor_profiles.media_routes import MediaAssetUserRouter, MediaAssetAdminRouter
from oauth.routes import OAuthRouter
from employer.routes import EmployerRouter, EmployerProRouter, EmployerFavoritesRouter, EmployerReportsRouter, ActorFeedRouter, SubscriptionRouter, SuperAdminRouter, ActorReviewRouter
from billing.routes import BillingRouter, SearchRouter
from crm.routes import NotificationRouter, TrustScoreRouter, BlacklistRouter, CollaborationRouter
from crm.push_routes import PushRouter


class AdminRouter:
    def __init__(self):
        self.all_router: APIRouter = APIRouter(prefix="/admin",)
        self.include_routers()

    def include_routers(self) -> None:
        self.all_router.include_router(AdminAuthRouter().router)
        self.all_router.include_router(AdminUserRouter().router)
        self.all_router.include_router(AdminReportRouter().router)
        self.all_router.include_router(AdminCastingRouter().router)
        self.all_router.include_router(AdminActorRouter().router)
        self.all_router.include_router(AdminCitiesRouter().router)
        # V2: Actor Profiles (multi-profile) для admin
        self.all_router.include_router(ActorProfileAdminRouter().router)
        # V2: Media Assets для admin (SuperAdmin может редактировать фото актёров)
        self.all_router.include_router(MediaAssetAdminRouter().router)
        # V2: SSOT Shortlists
        self.all_router.include_router(ShortlistRouter().router)

class ProducerRouter:
    def __init__(self):
        self.all_router: APIRouter = APIRouter(prefix="/producer",)
        self.include_routers()

    def include_routers(self) -> None:
        self.all_router.include_router(ProducerReportRouter().router)
        self.all_router.include_router(ProducerActorRouter().router)

class TmaRouter:
    def __init__(self):
        self.all_router: APIRouter = APIRouter(prefix="/tma",)
        self.include_routers()

    def include_routers(self) -> None:
        self.all_router.include_router(TmaAuthRouter().router)
        self.all_router.include_router(TmaProfileRouter().router)
        self.all_router.include_router(TmaCastingRouter().router)
        self.all_router.include_router(TmaCitiesRouter().router)
        # V2: Actor Profiles + Media для пользователя (актёра)
        self.all_router.include_router(ActorProfileUserRouter().router)
        self.all_router.include_router(MediaAssetUserRouter().router)


application_routers = APIRouter()
application_routers.include_router(AdminRouter().all_router)
application_routers.include_router(ProducerRouter().all_router)
application_routers.include_router(TmaRouter().all_router)

# V2: Независимый Auth Service (Email/Password + OTP)
application_routers.include_router(AuthV2Router().router)

# V2: Публичный доступ к шорт-листам по токену (без авторизации)
public_shortlist_router = APIRouter(prefix="/public", tags=["public"])
public_shortlist_router.include_router(ShortlistRouter().router)
application_routers.include_router(public_shortlist_router)

# V3: Мультипровайдерная OAuth авторизация (Telegram + VK)
application_routers.include_router(OAuthRouter().router)

# V3: Employer (работодатель) — CRUD проектов + просмотр откликнувшихся
employer_router = APIRouter(prefix="/employer", tags=["employer"])
employer_router.include_router(EmployerRouter().router)
# V3: АдминПРО — доступ ко ВСЕМ актёрам
employer_router.include_router(EmployerProRouter().router)
# V3: Отчёты/шорт-листы для работодателя
employer_router.include_router(EmployerReportsRouter().router)
employer_router.include_router(EmployerFavoritesRouter().router)
employer_router.include_router(ActorReviewRouter().router)
application_routers.include_router(employer_router)

# V3: Actor Feed — лента проектов + отклики
application_routers.include_router(ActorFeedRouter().router)

# V3: Подписки (admin / admin_pro)
application_routers.include_router(SubscriptionRouter().router)

# V3: SuperAdmin — полный доступ
application_routers.include_router(SuperAdminRouter().router)

# Season 03: Billing + Search
application_routers.include_router(BillingRouter().router)
application_routers.include_router(SearchRouter().router)

# Season 04: CRM
application_routers.include_router(NotificationRouter().router)
application_routers.include_router(TrustScoreRouter().router)
application_routers.include_router(BlacklistRouter().router)
application_routers.include_router(CollaborationRouter().router)

# Web Push subscriptions (PWA notifications)
application_routers.include_router(PushRouter().router)
