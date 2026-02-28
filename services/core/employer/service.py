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

            await session.delete(casting)
            await session.commit()
            return casting_id

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

                    respondents.append({
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
                        "responded_at": r.created_at,
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
                    "casting_status": c.status.value if c and hasattr(c.status, 'value') else str(c.status) if c else "unknown",
                    "self_test_url": r.self_test_url,
                    "responded_at": r.created_at,
                })

            return {"responses": items, "total": len(items)}
