"""
Employer Service — бизнес-логика для работодателя (Admin) и актёра.
- Employer: CRUD своих проектов + просмотр откликнувшихся
- Actor: лента проектов + отклики + история
- SuperAdmin: полный доступ
"""
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import select, func, and_
from sqlalchemy.orm import joinedload

from postgres.database import async_session_maker as async_session
from castings.models import Casting
from profiles.models import Profile, Response
from users.models import User
from users.enums import Roles
from users.services.auth_token.types.jwt import JWT
from fastapi import HTTPException, status
from crm.models import NotificationType
from crm.service import NotificationService, ActionLogService
from castings.enums import CastingStatusEnum


class EmployerService:
    """Сервис для работодателя — управление своими проектами."""

    @staticmethod
    async def create_project(user_token: JWT, title: str, description: str) -> dict:
        async with async_session() as session:
            casting = Casting(
                title=title,
                description=description,
                owner_id=int(user_token.id),
            )
            session.add(casting)
            await session.flush()
            await session.commit()
            try:
                await ActionLogService.log_event(
                    casting_id=casting.id,
                    user_id=int(user_token.id),
                    action_type='project_created',
                    message=f"Project created: {casting.title}",
                )
            except Exception:
                pass
            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": casting.owner_id,
                "response_count": 0,
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def get_my_projects(user_token: JWT, page: int = 1, page_size: int = 20) -> dict:
        async with async_session() as session:
            user_id = int(user_token.id)
            role = user_token.role

            base_query = select(Casting)
            if role not in [Roles.owner.value, 'owner']:
                base_query = base_query.where(Casting.owner_id == user_id)

            count_q = select(func.count()).select_from(base_query.subquery())
            total = (await session.execute(count_q)).scalar() or 0

            query = base_query.order_by(Casting.created_at.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)
            result = await session.execute(query)
            castings = result.scalars().unique().all()

            projects = []
            for c in castings:
                resp_count = (await session.execute(
                    select(func.count()).where(Response.casting_id == c.id)
                )).scalar() or 0
                projects.append({
                    "id": c.id,
                    "title": c.title,
                    "description": c.description,
                    "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                    "owner_id": getattr(c, 'owner_id', None) or 0,
                    "response_count": resp_count,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at,
                })

            return {"projects": projects, "total": total}

    @staticmethod
    async def update_project(user_token: JWT, casting_id: int, title: Optional[str], description: Optional[str]) -> dict:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                raise HTTPException(status_code=403, detail="You can only edit your own projects")

            if title:
                casting.title = title
            if description:
                casting.description = description
            await session.commit()
            try:
                await ActionLogService.log_event(
                    casting_id=casting.id,
                    user_id=int(user_token.id),
                    action_type='project_updated',
                    message=f"Project updated: {casting.title}",
                )
            except Exception:
                pass

            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": getattr(casting, 'owner_id', 0),
                "response_count": 0,
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def delete_project(user_token: JWT, casting_id: int) -> int:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                raise HTTPException(status_code=403, detail="You can only delete your own projects")

            deleted_title = casting.title
            await session.delete(casting)
            await session.commit()
            try:
                await ActionLogService.log_event(
                    casting_id=casting_id,
                    user_id=int(user_token.id),
                    action_type='project_deleted',
                    message=f"Project deleted: {deleted_title}",
                )
            except Exception:
                pass
            return casting_id

    @staticmethod
    async def publish_project(user_token: JWT, casting_id: int) -> dict:
        """
        Publish own project for employer/employer_pro (and owner).
        Once published, actors can see it in the feed.
        """
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                raise HTTPException(status_code=403, detail="You can only publish your own projects")

            if casting.status == CastingStatusEnum.closed:
                raise HTTPException(status_code=400, detail="Closed project cannot be published")

            casting.status = CastingStatusEnum.published
            await session.commit()

            try:
                await ActionLogService.log_event(
                    casting_id=casting.id,
                    user_id=int(user_token.id),
                    action_type='project_published',
                    message=f"Project published: {casting.title}",
                )
            except Exception:
                pass

            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": getattr(casting, 'owner_id', 0),
                "response_count": 0,
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def get_respondents(user_token: JWT, casting_id: int, page: int = 1, page_size: int = 20) -> dict:
        """Employer видит ТОЛЬКО актёров, откликнувшихся на ЕГО проект."""
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                raise HTTPException(status_code=403, detail="You can only view respondents of your own projects")

            count_q = select(func.count()).where(Response.casting_id == casting_id)
            total = (await session.execute(count_q)).scalar() or 0

            query = (
                select(Response)
                .options(joinedload(Response.profile))
                .where(Response.casting_id == casting_id)
                .order_by(Response.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            result = await session.execute(query)
            responses = result.scalars().unique().all()

            from users.models import ActorProfile

            respondents = []
            for r in responses:
                p = r.profile
                if p:
                    photo = None
                    if hasattr(p, 'images') and p.images:
                        photo = p.images[0].crop_photo_url or p.images[0].photo_url

                    age = None
                    if p.date_of_birth:
                        today = datetime.now().date()
                        age = today.year - p.date_of_birth.year

                    ap_result = await session.execute(
                        select(ActorProfile).where(
                            ActorProfile.user_id == p.user_id,
                            ActorProfile.is_deleted == False,
                        ).order_by(ActorProfile.created_at.desc()).limit(1)
                    )
                    ap = ap_result.scalar_one_or_none()

                    media_assets = []
                    ap_photo = None
                    if ap and ap.media_assets:
                        for m in ap.media_assets:
                            media_assets.append({
                                "id": m.id,
                                "file_type": m.file_type,
                                "original_url": m.original_url,
                                "processed_url": m.processed_url,
                                "thumbnail_url": m.thumbnail_url,
                                "is_primary": m.is_primary,
                            })
                            if m.file_type == "photo" and m.is_primary:
                                ap_photo = m.processed_url or m.original_url

                    respondents.append({
                        "profile_id": p.id,
                        "response_id": r.id,
                        "response_status": getattr(r, 'status', 'pending') or 'pending',
                        "actor_profile_id": ap.id if ap else None,
                        "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                        "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                        "display_name": ap.display_name if ap else None,
                        "gender": p.gender.value if hasattr(p.gender, 'value') else str(p.gender) if p.gender else (ap.gender if ap else None),
                        "date_of_birth": str(ap.date_of_birth) if ap and ap.date_of_birth else (str(p.date_of_birth) if p.date_of_birth else None),
                        "city": (ap.city if ap and ap.city else None) or (str(p.city_full) if p.city_full else None),
                        "age": age,
                        "phone_number": (ap.phone_number if ap else None) or p.phone_number,
                        "email": (ap.email if ap else None) or p.email,
                        "qualification": p.qualification.value if hasattr(p.qualification, 'value') else str(p.qualification) if p.qualification else (ap.qualification if ap else None),
                        "experience": (ap.experience if ap else None) or p.experience,
                        "about_me": (ap.about_me if ap else None) or p.about_me,
                        "look_type": ap.look_type if ap else (p.look_type.value if hasattr(p, 'look_type') and p.look_type and hasattr(p.look_type, 'value') else None),
                        "hair_color": ap.hair_color if ap else (p.hair_color.value if hasattr(p, 'hair_color') and p.hair_color and hasattr(p.hair_color, 'value') else None),
                        "hair_length": ap.hair_length if ap else (p.hair_length.value if hasattr(p, 'hair_length') and p.hair_length and hasattr(p.hair_length, 'value') else None),
                        "height": ap.height if ap else (float(p.height) if p.height else None),
                        "clothing_size": (ap.clothing_size if ap else None) or (str(p.clothing_size) if p.clothing_size else None),
                        "shoe_size": (ap.shoe_size if ap else None) or (str(p.shoe_size) if p.shoe_size else None),
                        "bust_volume": ap.bust_volume if ap else (float(p.bust_volume) if p.bust_volume else None),
                        "waist_volume": ap.waist_volume if ap else (float(p.waist_volume) if p.waist_volume else None),
                        "hip_volume": ap.hip_volume if ap else (float(p.hip_volume) if p.hip_volume else None),
                        "video_intro": (ap.video_intro if ap else None) or p.video_intro,
                        "trust_score": ap.trust_score if ap else 0,
                        "photo_url": ap_photo or photo,
                        "media_assets": media_assets,
                        "responded_at": r.created_at,
                        "self_test_url": r.self_test_url,
                    })

            return {
                "respondents": respondents,
                "total": total,
                "project_title": casting.title,
            }


    @staticmethod
    async def get_all_actors(user_token: JWT, page: int = 1, page_size: int = 20, search: Optional[str] = None) -> dict:
        """АдминПРО: просмотр ВСЕХ актёров в базе (не только откликнувшихся)."""
        role = user_token.role
        allowed = [Roles.owner.value, 'owner', Roles.employer_pro.value, 'employer_pro',
                   Roles.administrator.value, 'administrator', Roles.manager.value, 'manager']
        if role not in allowed:
            raise HTTPException(status_code=403, detail="Only AdminPro or higher can view all actors")

        async with async_session() as session:
            base = select(Profile).where(Profile.first_name.isnot(None))

            if search:
                base = base.where(
                    Profile.first_name.ilike(f"%{search}%") |
                    Profile.last_name.ilike(f"%{search}%")
                )

            count_q = select(func.count()).select_from(base.subquery())
            total = (await session.execute(count_q)).scalar() or 0

            query = base.order_by(Profile.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
            result = await session.execute(query)
            profiles = result.scalars().all()

            actors = []
            for p in profiles:
                photo = None
                if hasattr(p, 'images') and p.images:
                    photo = p.images[0].crop_photo_url or p.images[0].photo_url

                age = None
                if p.date_of_birth:
                    today = datetime.now().date()
                    age = today.year - p.date_of_birth.year

                actors.append({
                    "profile_id": p.id,
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "gender": p.gender.value if hasattr(p.gender, 'value') else str(p.gender) if p.gender else None,
                    "city": str(p.city_full) if p.city_full else None,
                    "age": age,
                    "qualification": p.qualification.value if hasattr(p.qualification, 'value') else str(p.qualification) if p.qualification else None,
                    "experience": p.experience,
                    "about_me": p.about_me,
                    "photo_url": photo,
                    "responded_at": p.created_at,
                })

            return {"respondents": actors, "total": total, "project_title": "All Actors (Pro)"}


class ActorFeedService:
    """Сервис для актёра — лента проектов, отклики, история."""

    @staticmethod
    async def get_feed(page: int = 1, page_size: int = 20) -> dict:
        """Лента опубликованных проектов для актёра."""
        async with async_session() as session:
            from castings.enums import CastingStatusEnum

            base = select(Casting).where(Casting.status == CastingStatusEnum.published)
            count_q = select(func.count()).select_from(base.subquery())
            total = (await session.execute(count_q)).scalar() or 0

            query = base.order_by(Casting.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
            result = await session.execute(query)
            castings = result.scalars().all()

            projects = []
            for c in castings:
                projects.append({
                    "id": c.id,
                    "title": c.title,
                    "description": c.description,
                    "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                    "created_at": c.created_at,
                })

            return {"projects": projects, "total": total}

    @staticmethod
    async def respond_to_casting(user_token: JWT, casting_id: int, self_test_url: Optional[str] = None) -> dict:
        """Актёр откликается на проект."""
        async with async_session() as session:
            profile_id = int(user_token.profile_id) if user_token.profile_id != "0" else None
            if not profile_id:
                user_id = int(user_token.id)
                prof_result = await session.execute(
                    select(Profile).where(Profile.user_id == user_id)
                )
                profile = prof_result.scalar_one_or_none()
                if not profile:
                    raise HTTPException(status_code=400, detail="Create a profile first")
                profile_id = profile.id

            existing = await session.execute(
                select(Response).where(
                    and_(Response.profile_id == profile_id, Response.casting_id == casting_id)
                )
            )
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Already responded to this casting")

            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Casting not found")

            response = Response(
                profile_id=profile_id,
                casting_id=casting_id,
                self_test_url=self_test_url,
            )
            session.add(response)
            await session.commit()
            try:
                owner_id = getattr(casting, 'owner_id', None)
                if owner_id:
                    await NotificationService.create(
                        user_id=int(owner_id),
                        type=NotificationType.NEW_RESPONSE,
                        title="Новый отклик на проект",
                        message=f"Поступил новый отклик на проект: {casting.title}",
                        casting_id=casting_id,
                        profile_id=profile_id,
                    )
                await ActionLogService.log_event(
                    casting_id=casting_id,
                    user_id=int(user_token.id),
                    action_type='response_sent',
                    message=f"Actor profile #{profile_id} responded to project",
                )
            except Exception:
                pass

            return {
                "id": response.id,
                "casting_id": casting_id,
                "casting_title": casting.title,
                "casting_status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "self_test_url": self_test_url,
                "responded_at": response.created_at,
            }

    @staticmethod
    async def get_my_responses(user_token: JWT) -> dict:
        """История откликов актёра."""
        async with async_session() as session:
            user_id = int(user_token.id)
            prof_result = await session.execute(
                select(Profile).where(Profile.user_id == user_id)
            )
            profile = prof_result.scalar_one_or_none()
            if not profile:
                return {"responses": [], "total": 0}

            query = (
                select(Response)
                .options(joinedload(Response.casting))
                .where(Response.profile_id == profile.id)
                .order_by(Response.created_at.desc())
            )
            result = await session.execute(query)
            responses = result.scalars().unique().all()

            items = []
            for r in responses:
                c = r.casting
                items.append({
                    "id": r.id,
                    "casting_id": r.casting_id,
                    "casting_title": c.title if c else "Unknown",
                    "casting_description": c.description if c else None,
                    "casting_status": c.status.value if c and hasattr(c.status, 'value') else str(c.status) if c else "unknown",
                    "response_status": getattr(r, 'status', 'pending') or 'pending',
                    "self_test_url": r.self_test_url,
                    "responded_at": r.created_at,
                })

            return {"responses": items, "total": len(items)}
