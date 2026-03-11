"""
Employer & Actor Routes — разделение прав по ролям.

SuperAdmin (owner): полный доступ, удаление любых анкет/проектов.
Admin/Employer: CRUD своих проектов, просмотр только откликнувшихся актёров.
Actor (user): профиль, лента проектов, отклики, история.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional

from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import admin_authorized, tma_authorized, employer_authorized
from users.enums import Roles
from employer.service import EmployerService, ActorFeedService
from employer.schemas import (
    SProjectCreate, SProjectUpdate, SProjectData, SProjectList,
    SRespondentsList, SActorResponseCreate, SActorResponse, SActorResponseHistory,
)


class EmployerRouter:
    """Роуты для работодателя (employer) — управление СВОИМИ проектами."""

    def __init__(self):
        self.router = APIRouter(tags=["employer-projects"], prefix="/projects")
        self._include()

    def _include(self):
        async def _check_employer_verified(jwt_id: str, role: str):
            """Проверяет верификацию employer перед действием с проектами."""
            if role in ['owner', Roles.owner.value]:
                return
            from postgres.database import async_session_maker
            from users.models import User
            async with async_session_maker() as session:
                user = await session.get(User, int(jwt_id))
                if user and not user.is_employer_verified:
                    raise HTTPException(
                        status_code=403,
                        detail="employer_not_verified"
                    )

        @self.router.post("/", response_model=SProjectData)
        async def create_project(
            data: SProjectCreate,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Создать проект (объявление о наборе)."""
            await _check_employer_verified(authorized.id, authorized.role)
            return await EmployerService.create_project(
                user_token=authorized, title=data.title, description=data.description
            )

        @self.router.get("/verification-status/")
        async def get_verification_status(
            authorized: JWT = Depends(employer_authorized),
        ):
            """Проверить статус верификации employer (прошёл ли собеседование)."""
            if authorized.role in ['owner', Roles.owner.value]:
                return {"is_verified": True}
            from postgres.database import async_session_maker
            from users.models import User
            async with async_session_maker() as session:
                user = await session.get(User, int(authorized.id))
                return {"is_verified": bool(user and user.is_employer_verified)}

        @self.router.get("/", response_model=SProjectList)
        async def get_my_projects(
            page: int = Query(1, gt=0),
            page_size: int = Query(20, gt=0),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Список моих проектов (employer видит только свои, superadmin — все)."""
            return await EmployerService.get_my_projects(
                user_token=authorized, page=page, page_size=page_size
            )

        @self.router.patch("/{casting_id}/", response_model=SProjectData)
        async def update_project(
            casting_id: int,
            data: SProjectUpdate,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Обновить свой проект."""
            return await EmployerService.update_project(
                user_token=authorized, casting_id=casting_id,
                title=data.title, description=data.description,
            )

        @self.router.delete("/{casting_id}/")
        async def delete_project(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Удалить свой проект. SuperAdmin может удалить любой."""
            return await EmployerService.delete_project(
                user_token=authorized, casting_id=casting_id
            )

        @self.router.post("/{casting_id}/publish/", response_model=SProjectData)
        async def publish_project(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Опубликовать свой проект (доступно для Админ/Админ PRO/owner)."""
            await _check_employer_verified(authorized.id, authorized.role)
            return await EmployerService.publish_project(
                user_token=authorized, casting_id=casting_id
            )

        @self.router.get("/{casting_id}/respondents/", response_model=SRespondentsList)
        async def get_respondents(
            casting_id: int,
            page: int = Query(1, gt=0),
            page_size: int = Query(20, gt=0),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Список откликнувшихся актёров (только для своих проектов)."""
            return await EmployerService.get_respondents(
                user_token=authorized, casting_id=casting_id,
                page=page, page_size=page_size,
            )


class EmployerProRouter:
    """Роуты для АдминПРО — доступ ко ВСЕМ актёрам + шорт-листы."""

    def __init__(self):
        self.router = APIRouter(tags=["employer-pro"], prefix="/actors")
        self._include()

    def _include(self):
        @self.router.get("/all/", response_model=SRespondentsList)
        async def get_all_actors(
            search: Optional[str] = None,
            page: int = Query(1, gt=0),
            page_size: int = Query(20, gt=0),
            authorized: JWT = Depends(employer_authorized),
        ):
            """АдминПРО: просмотр ВСЕХ актёров в базе (не только откликнувшихся)."""
            return await EmployerService.get_all_actors(
                user_token=authorized, page=page, page_size=page_size, search=search,
            )


class EmployerReportsRouter:
    """Роуты для Employer/EmployerPro — работа с отчётами и шорт-листами."""

    def __init__(self):
        self.router = APIRouter(tags=["employer-reports"], prefix="/reports")
        self._include()

    def _include(self):
        @self.router.get("/")
        async def get_my_reports(
            page: int = Query(1, gt=0),
            page_size: int = Query(20, gt=0),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Список отчётов (шорт-листов) работодателя."""
            from postgres.database import async_session_maker
            from reports.models import Report
            from castings.models import Casting
            from sqlalchemy import select, func
            async with async_session_maker() as session:
                user_id = int(authorized.id)
                role = authorized.role

                base = select(Report).join(Casting, Report.casting_id == Casting.id)
                if role not in ['owner', 'administrator', 'manager']:
                    base = base.where(Casting.owner_id == user_id)

                total = (await session.execute(select(func.count()).select_from(base.subquery()))).scalar() or 0
                result = await session.execute(
                    base.order_by(Report.created_at.desc())
                    .offset((page - 1) * page_size).limit(page_size)
                )
                reports = result.scalars().unique().all()
                return {
                    "reports": [
                        {
                            "id": r.id,
                            "title": r.title,
                            "casting_id": r.casting_id,
                            "public_id": r.public_id,
                            "created_at": str(r.created_at),
                        }
                        for r in reports
                    ],
                    "total": total,
                }

        @self.router.post("/create/")
        async def create_report(
            casting_id: int = Query(...),
            title: str = Query(...),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Создать отчёт (шорт-лист) для кастинга."""
            from postgres.database import async_session_maker
            from reports.models import Report
            from castings.models import Casting
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Casting not found")

                role = authorized.role
                if role not in ['owner', 'administrator', 'manager']:
                    if getattr(casting, 'owner_id', None) != int(authorized.id):
                        raise HTTPException(status_code=403, detail="Not your casting")

                report = Report(casting_id=casting_id, title=title)
                session.add(report)
                await session.flush()
                await session.commit()
                return {
                    "id": report.id,
                    "title": report.title,
                    "casting_id": report.casting_id,
                    "public_id": report.public_id,
                }

        @self.router.post("/{report_id}/add-actors/")
        async def add_actors_to_report(
            report_id: int,
            profile_ids: list[int] = Query(...),
            authorized: JWT = Depends(employer_authorized),
        ):
            """
            Добавить актёров в шорт-лист.
            AdminPro: может добавить ЛЮБОГО актёра (откликнувшегося и нет).
            Admin: только откликнувшихся на свой кастинг.
            """
            from postgres.database import async_session_maker
            from reports.models import Report, ProfilesReports
            from profiles.models import Response
            from castings.models import Casting
            from sqlalchemy import select, and_
            async with async_session_maker() as session:
                report = await session.get(Report, report_id)
                if not report:
                    raise HTTPException(status_code=404, detail="Report not found")

                casting = await session.get(Casting, report.casting_id)
                role = authorized.role
                user_id = int(authorized.id)

                if role not in ['owner', 'administrator', 'manager']:
                    if getattr(casting, 'owner_id', None) != user_id:
                        raise HTTPException(status_code=403, detail="Not your report")

                is_pro = role in ['employer_pro', 'owner', 'administrator', 'manager']

                added = 0
                for pid in profile_ids:
                    if not is_pro:
                        resp = await session.execute(
                            select(Response).where(
                                and_(Response.profile_id == pid, Response.casting_id == report.casting_id)
                            )
                        )
                        if not resp.scalar_one_or_none():
                            continue

                    existing = await session.execute(
                        select(ProfilesReports).where(
                            and_(ProfilesReports.profile_id == pid, ProfilesReports.report_id == report_id)
                        )
                    )
                    if existing.scalar_one_or_none():
                        continue

                    link = ProfilesReports(profile_id=pid, report_id=report_id)
                    session.add(link)
                    added += 1

                await session.commit()
                return {"added": added, "report_id": report_id}

        @self.router.get("/{report_id}/")
        async def get_report_detail(
            report_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Детали шорт-листа с актёрами."""
            from postgres.database import async_session_maker
            from reports.models import Report, ProfilesReports
            from profiles.models import Profile
            from castings.models import Casting
            from sqlalchemy import select
            from sqlalchemy.orm import joinedload
            async with async_session_maker() as session:
                report = await session.get(Report, report_id)
                if not report:
                    raise HTTPException(status_code=404, detail="Report not found")

                casting = await session.get(Casting, report.casting_id)
                role = authorized.role
                if role not in ['owner', 'administrator', 'manager']:
                    if getattr(casting, 'owner_id', None) != int(authorized.id):
                        raise HTTPException(status_code=403, detail="Not your report")

                result = await session.execute(
                    select(ProfilesReports)
                    .options(joinedload(ProfilesReports.profile))
                    .where(ProfilesReports.report_id == report_id)
                )
                links = result.scalars().unique().all()

                actors = []
                for link in links:
                    p = link.profile
                    if p:
                        actors.append({
                            "profile_id": p.id,
                            "first_name": p.first_name,
                            "last_name": p.last_name,
                            "gender": p.gender.value if hasattr(p.gender, 'value') else str(p.gender) if p.gender else None,
                            "favorite": link.favorite,
                        })

                return {
                    "id": report.id,
                    "title": report.title,
                    "public_id": report.public_id,
                    "casting_id": report.casting_id,
                    "actors": actors,
                    "total": len(actors),
                }


class ActorFeedRouter:
    """Роуты для актёра — лента проектов + отклики."""

    def __init__(self):
        self.router = APIRouter(tags=["actor-feed"], prefix="/feed")
        self._include()

    def _include(self):
        @self.router.get("/projects/")
        async def get_project_feed(
            page: int = Query(1, gt=0),
            page_size: int = Query(20, gt=0),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Лента опубликованных проектов для актёра."""
            return await ActorFeedService.get_feed(page=page, page_size=page_size)

        @self.router.post("/respond/", response_model=SActorResponse)
        async def respond_to_casting(
            data: SActorResponseCreate,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Откликнуться на проект."""
            return await ActorFeedService.respond_to_casting(
                user_token=authorized,
                casting_id=data.casting_id,
                self_test_url=data.self_test_url,
            )

        @self.router.get("/my-responses/", response_model=SActorResponseHistory)
        async def get_my_responses(
            authorized: JWT = Depends(tma_authorized),
        ):
            """История моих откликов."""
            return await ActorFeedService.get_my_responses(user_token=authorized)


class SubscriptionRouter:
    """Роуты для управления подписками."""

    def __init__(self):
        self.router = APIRouter(tags=["subscriptions"], prefix="/subscriptions")
        self._include()

    def _include(self):
        @self.router.post("/activate/")
        async def activate_subscription(
            plan: str = Query(..., description="admin or admin_pro"),
            days: int = Query(30, gt=0),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Активировать подписку и получить новый токен с обновлённой ролью."""
            from employer.subscription import SubscriptionService
            from users.services.auth_token.service import TokenService
            result = await SubscriptionService.activate_subscription(
                user_id=int(authorized.id), plan=plan, days=days
            )
            new_token = TokenService.generate_access_token(
                user_id=str(authorized.id),
                profile_id=str(authorized.profile_id),
                role=result["role"],
            )
            result["access_token"] = str(new_token)
            return result

        @self.router.get("/my/")
        async def get_my_subscription(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Текущая подписка пользователя."""
            from employer.subscription import SubscriptionService
            sub = await SubscriptionService.get_subscription(user_id=int(authorized.id))
            if not sub:
                return {"plan": None, "is_active": False, "message": "No active subscription"}
            return sub

        @self.router.post("/switch-role/")
        async def switch_role(
            role: str = Query(..., description="user or agent"),
            authorized: JWT = Depends(tma_authorized),
        ):
            """
            Переключить базовую роль без подписки.
            Используется для выбора Актёр / Агент.
            """
            from postgres.database import async_session_maker
            from users.models import User
            from users.enums import ModelRoles
            from users.services.auth_token.service import TokenService

            role_map = {
                "user": ModelRoles.user,
                "agent": ModelRoles.agent,
            }
            if role not in role_map:
                raise HTTPException(status_code=400, detail="Role must be 'user' or 'agent'")

            async with async_session_maker() as session:
                user = await session.get(User, int(authorized.id))
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.role = role_map[role]
                session.add(user)
                try:
                    await session.commit()
                except Exception as exc:
                    # Helpful error for environments where DB migrations are outdated.
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to switch role. Ensure DB migrations are applied (alembic upgrade heads).",
                    ) from exc

            new_token = TokenService.generate_access_token(
                user_id=str(authorized.id),
                profile_id=str(authorized.profile_id),
                role=role_map[role].value,
            )
            return {"role": role_map[role].value, "access_token": str(new_token)}


class SuperAdminRouter:
    """Роуты для SuperAdmin — полный доступ."""

    def __init__(self):
        self.router = APIRouter(tags=["superadmin"], prefix="/superadmin")
        self._include()

    def _include(self):
        @self.router.delete("/profiles/{profile_id}/")
        async def delete_any_profile(
            profile_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: удалить любую анкету актёра."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin can delete any profile")

            from postgres.database import async_session_maker
            from profiles.models import Profile
            async with async_session_maker() as session:
                profile = await session.get(Profile, profile_id)
                if not profile:
                    raise HTTPException(status_code=404, detail="Profile not found")
                await session.delete(profile)
                await session.commit()
            return {"deleted": profile_id}

        @self.router.delete("/castings/{casting_id}/")
        async def delete_any_casting(
            casting_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: удалить любой проект любого админа."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin can delete any casting")

            from postgres.database import async_session_maker
            from castings.models import Casting
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Casting not found")
                await session.delete(casting)
                await session.commit()
            return {"deleted": casting_id}

        @self.router.get("/stats/")
        async def platform_stats(
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: статистика платформы."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User
            from profiles.models import Profile
            from castings.models import Casting
            from sqlalchemy import select, func
            async with async_session_maker() as session:
                users_total = (await session.execute(select(func.count(User.id)))).scalar() or 0
                profiles_total = (await session.execute(select(func.count(Profile.id)))).scalar() or 0
                castings_total = (await session.execute(select(func.count(Casting.id)))).scalar() or 0

                roles = {}
                for row in (await session.execute(
                    select(User.role, func.count()).group_by(User.role)
                )).all():
                    roles[row[0].value if hasattr(row[0], 'value') else str(row[0])] = row[1]

                return {
                    "users_total": users_total,
                    "profiles_total": profiles_total,
                    "castings_total": castings_total,
                    "roles": roles,
                }

        @self.router.get("/users/")
        async def list_all_users(
            page: int = Query(1, gt=0),
            page_size: int = Query(50, gt=0),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: список всех пользователей."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User
            from sqlalchemy import select, func
            async with async_session_maker() as session:
                total = (await session.execute(select(func.count(User.id)))).scalar() or 0
                query = select(User).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
                users = (await session.execute(query)).scalars().all()
                return {
                    "users": [
                        {
                            "id": u.id,
                            "role": u.role.value if hasattr(u.role, 'value') else str(u.role),
                            "first_name": u.first_name,
                            "last_name": u.last_name,
                            "email": u.email,
                            "telegram_username": u.telegram_username,
                            "is_active": u.is_active,
                            "is_employer_verified": getattr(u, 'is_employer_verified', False),
                            "created_at": str(u.created_at),
                        }
                        for u in users
                    ],
                    "total": total,
                }

        @self.router.get("/actors/")
        async def get_all_actors_admin(
            page: int = Query(1, gt=0),
            page_size: int = Query(100, gt=0),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: все актёрские профили (actor_profiles + legacy profiles)."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from sqlalchemy import select, func
            from users.models import User, ActorProfile
            from profiles.models import Profile

            results = []
            async with async_session_maker() as session:
                ap_q = select(ActorProfile).where(ActorProfile.is_deleted == False).order_by(ActorProfile.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
                aps = (await session.execute(ap_q)).scalars().all()
                for p in aps:
                    owner = await session.get(User, p.user_id)
                    results.append({
                        "profile_id": p.id,
                        "source": "actor_profiles",
                        "first_name": p.first_name,
                        "last_name": p.last_name,
                        "gender": p.gender,
                        "city": p.city,
                        "qualification": p.qualification,
                        "phone_number": p.phone_number,
                        "owner_name": f"{owner.first_name or ''} {owner.last_name or ''}".strip() if owner else '—',
                        "owner_role": (owner.role.value if hasattr(owner.role, 'value') else str(owner.role)) if owner else '—',
                        "photo_url": None,
                    })

                legacy_q = select(Profile).order_by(Profile.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
                legacies = (await session.execute(legacy_q)).scalars().all()
                seen_ids = {r["profile_id"] for r in results}
                for p in legacies:
                    if p.id in seen_ids:
                        continue
                    photo = None
                    if hasattr(p, 'images') and p.images:
                        photo = p.images[0].crop_photo_url or p.images[0].photo_url
                    results.append({
                        "profile_id": p.id,
                        "source": "profiles",
                        "first_name": p.first_name,
                        "last_name": p.last_name,
                        "gender": p.gender.value if p.gender and hasattr(p.gender, 'value') else (str(p.gender) if p.gender else None),
                        "city": str(p.city_full) if hasattr(p, 'city_full') and p.city_full else None,
                        "qualification": getattr(p, 'qualification', None),
                        "phone_number": p.phone_number,
                        "owner_name": None,
                        "owner_role": None,
                        "photo_url": photo,
                    })

            return {"actors": results, "total": len(results)}

        @self.router.get("/users/{user_id}/details/")
        async def get_user_details(
            user_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: детальный просмотр пользователя по роли."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from sqlalchemy import select, func
            from users.models import User, ActorProfile
            from profiles.models import Profile, Response
            from castings.models import Casting
            from reports.models import Report, ProfilesReports

            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")

                # Multi-profile (v2+)
                ap_result = await session.execute(
                    select(ActorProfile).where(
                        ActorProfile.user_id == user_id,
                        ActorProfile.is_deleted == False,
                    ).order_by(ActorProfile.created_at.desc())
                )
                actor_profiles = ap_result.scalars().all()

                # Legacy single profile (for responses/shortlists in current DB flow)
                legacy_profile_result = await session.execute(
                    select(Profile).where(Profile.user_id == user_id)
                )
                legacy_profile = legacy_profile_result.scalar_one_or_none()

                castings_result = await session.execute(
                    select(Casting).where(Casting.owner_id == user_id).order_by(Casting.created_at.desc())
                )
                user_castings = castings_result.unique().scalars().all()

                castings_payload = []
                for c in user_castings:
                    resp_result = await session.execute(
                        select(Response).where(Response.casting_id == c.id).order_by(Response.created_at.desc())
                    )
                    responses = resp_result.unique().scalars().all()

                    respondents_payload = []
                    for r in responses:
                        p = r.profile
                        if not p:
                            continue
                        shortlist_cnt = (await session.execute(
                            select(func.count(ProfilesReports.id))
                            .join(Report, Report.id == ProfilesReports.report_id)
                            .where(
                                ProfilesReports.profile_id == p.id,
                                Report.casting_id == c.id,
                            )
                        )).scalar() or 0
                        respondents_payload.append({
                            "profile_id": p.id,
                            "first_name": p.first_name,
                            "last_name": p.last_name,
                            "responded_at": str(r.created_at),
                            "is_shortlisted": shortlist_cnt > 0,
                        })

                    shortlist_total = (await session.execute(
                        select(func.count(ProfilesReports.id))
                        .join(Report, Report.id == ProfilesReports.report_id)
                        .where(Report.casting_id == c.id)
                    )).scalar() or 0

                    castings_payload.append({
                        "id": c.id,
                        "title": c.title,
                        "description": c.description,
                        "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                        "response_count": len(respondents_payload),
                        "shortlist_count": shortlist_total,
                        "respondents": respondents_payload,
                    })

                return {
                    "user": {
                        "id": user.id,
                        "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
                        "first_name": user.first_name,
                        "last_name": user.last_name,
                        "email": user.email,
                        "phone_number": getattr(user, 'phone_number', None),
                        "photo_url": getattr(user, 'photo_url', None),
                        "is_active": user.is_active,
                        "is_employer_verified": getattr(user, 'is_employer_verified', False),
                        "created_at": str(user.created_at),
                    },
                    "actor_profiles": [
                        {
                            "id": p.id,
                            "display_name": p.display_name,
                            "first_name": p.first_name,
                            "last_name": p.last_name,
                            "gender": p.gender,
                            "city": p.city,
                            "phone_number": p.phone_number,
                            "created_at": str(p.created_at),
                        }
                        for p in actor_profiles
                    ],
                    "legacy_profile": (
                        {
                            "id": legacy_profile.id,
                            "first_name": legacy_profile.first_name,
                            "last_name": legacy_profile.last_name,
                            "gender": legacy_profile.gender.value if legacy_profile.gender and hasattr(legacy_profile.gender, 'value') else (str(legacy_profile.gender) if legacy_profile and legacy_profile.gender else None),
                            "city": str(legacy_profile.city_full) if legacy_profile.city_full else None,
                            "phone_number": legacy_profile.phone_number,
                            "email": legacy_profile.email,
                        } if legacy_profile else None
                    ),
                    "castings": castings_payload,
                }

        @self.router.post("/users/{user_id}/verify/")
        async def verify_employer(
            user_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: подтвердить работодателя (пройдено собеседование)."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User
            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.is_employer_verified = True
                await session.commit()
            return {"verified": True, "user_id": user_id}

        @self.router.post("/users/{user_id}/unverify/")
        async def unverify_employer(
            user_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: отозвать верификацию работодателя."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User
            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.is_employer_verified = False
                await session.commit()
            return {"verified": False, "user_id": user_id}
