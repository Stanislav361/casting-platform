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
    SResponseStatusUpdate,
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
            """Проверить статус верификации employer + статус тикета."""
            if authorized.role in ['owner', Roles.owner.value]:
                return {"is_verified": True, "ticket_status": None}
            from postgres.database import async_session_maker
            from users.models import User, VerificationTicket
            from sqlalchemy import select
            async with async_session_maker() as session:
                user = await session.get(User, int(authorized.id))
                ticket = (await session.execute(
                    select(VerificationTicket)
                    .where(VerificationTicket.user_id == int(authorized.id))
                    .order_by(VerificationTicket.created_at.desc()).limit(1)
                )).scalar_one_or_none()
                return {
                    "is_verified": bool(user and user.is_employer_verified),
                    "ticket_status": ticket.status if ticket else None,
                    "ticket_id": ticket.id if ticket else None,
                }

        @self.router.post("/verification-request/")
        async def create_verification_request(
            company_name: str = Query("", description="Название компании"),
            about_text: str = Query("", description="Чем занимаетесь"),
            projects_text: str = Query("", description="Какие проекты планируете"),
            experience_text: str = Query("", description="Опыт в индустрии"),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Employer: отправить заявку на верификацию."""
            if authorized.role in ['owner', Roles.owner.value]:
                return {"error": "SuperAdmin не нуждается в верификации"}
            from postgres.database import async_session_maker
            from users.models import VerificationTicket, TicketMessage
            from sqlalchemy import select
            try:
                async with async_session_maker() as session:
                    existing = (await session.execute(
                        select(VerificationTicket).where(
                            VerificationTicket.user_id == int(authorized.id),
                            VerificationTicket.status == 'open',
                        )
                    )).scalar_one_or_none()
                    if existing:
                        raise HTTPException(status_code=400, detail="У вас уже есть открытая заявка")

                    ticket = VerificationTicket(
                        user_id=int(authorized.id),
                        company_name=company_name,
                        about_text=about_text,
                        projects_text=projects_text,
                        experience_text=experience_text,
                    )
                    session.add(ticket)
                    await session.flush()

                    intro = f"📋 Заявка на верификацию\n\n"
                    if company_name:
                        intro += f"🏢 Компания: {company_name}\n"
                    if about_text:
                        intro += f"💼 О себе: {about_text}\n"
                    if projects_text:
                        intro += f"🎬 Проекты: {projects_text}\n"
                    if experience_text:
                        intro += f"⭐ Опыт: {experience_text}\n"

                    msg = TicketMessage(
                        ticket_id=ticket.id,
                        sender_id=int(authorized.id),
                        message=intro.strip(),
                    )
                    session.add(msg)
                    await session.commit()
                    return {"ticket_id": ticket.id, "status": "open"}
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"verification-request error: {str(e)}")

        @self.router.get("/my-ticket/")
        async def get_my_ticket(
            authorized: JWT = Depends(employer_authorized),
        ):
            """Employer: получить свой тикет верификации с сообщениями."""
            from postgres.database import async_session_maker
            from users.models import User, VerificationTicket, TicketMessage
            from sqlalchemy import select
            async with async_session_maker() as session:
                ticket = (await session.execute(
                    select(VerificationTicket)
                    .where(VerificationTicket.user_id == int(authorized.id))
                    .order_by(VerificationTicket.created_at.desc()).limit(1)
                )).scalar_one_or_none()
                if not ticket:
                    return {"ticket": None, "messages": []}

                msgs = (await session.execute(
                    select(TicketMessage)
                    .where(TicketMessage.ticket_id == ticket.id)
                    .order_by(TicketMessage.created_at.asc())
                )).scalars().all()

                messages = []
                for m in msgs:
                    sender = await session.get(User, m.sender_id) if m.sender_id else None
                    sender_role = (sender.role.value if hasattr(sender.role, 'value') else str(sender.role)) if sender else None
                    if sender_role == 'owner':
                        sender_name = "👑 SuperAdmin"
                    elif sender:
                        sender_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip() or "Вы"
                    else:
                        sender_name = "System"
                    messages.append({
                        "id": m.id,
                        "sender_id": m.sender_id,
                        "sender_name": sender_name,
                        "sender_role": sender_role,
                        "is_mine": m.sender_id == int(authorized.id),
                        "message": m.message,
                        "created_at": str(m.created_at),
                    })

                return {
                    "ticket": {
                        "id": ticket.id,
                        "status": ticket.status,
                        "created_at": str(ticket.created_at),
                    },
                    "messages": messages,
                }

        @self.router.post("/my-ticket/message/")
        async def send_my_ticket_message(
            message: str = Query(..., min_length=1),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Employer: отправить сообщение в свой тикет."""
            from postgres.database import async_session_maker
            from users.models import VerificationTicket, TicketMessage
            from sqlalchemy import select
            async with async_session_maker() as session:
                ticket = (await session.execute(
                    select(VerificationTicket)
                    .where(VerificationTicket.user_id == int(authorized.id))
                    .order_by(VerificationTicket.created_at.desc()).limit(1)
                )).scalar_one_or_none()
                if not ticket:
                    raise HTTPException(status_code=404, detail="Тикет не найден")
                if ticket.status == 'rejected':
                    raise HTTPException(status_code=400, detail="Тикет отклонён")
                msg = TicketMessage(
                    ticket_id=ticket.id,
                    sender_id=int(authorized.id),
                    message=message,
                )
                session.add(msg)
                await session.commit()
            return {"sent": True}

        @self.router.get("/general-chat/")
        async def employer_general_chat(
            page_size: int = Query(50, gt=0),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Общий чат для верифицированных админов."""
            from postgres.database import async_session_maker
            from users.models import User, GeneralChatMessage
            from sqlalchemy import select
            if authorized.role not in ['owner', Roles.owner.value]:
                async with async_session_maker() as session:
                    user = await session.get(User, int(authorized.id))
                    if not user or not getattr(user, 'is_employer_verified', False):
                        raise HTTPException(status_code=403, detail="Доступ только для верифицированных")
            async with async_session_maker() as session:
                q = select(GeneralChatMessage).order_by(
                    GeneralChatMessage.created_at.desc()
                ).limit(page_size)
                msgs = (await session.execute(q)).scalars().all()
                result = []
                for m in reversed(msgs):
                    sender = await session.get(User, m.sender_id) if m.sender_id else None
                    sender_role = (sender.role.value if hasattr(sender.role, 'value') else str(sender.role)) if sender else None
                    if sender_role == 'owner':
                        sender_name = "👑 SuperAdmin"
                    elif sender:
                        role_label = {'employer': 'Админ', 'employer_pro': 'Админ PRO'}.get(sender_role, '')
                        name = f"{sender.first_name or ''} {sender.last_name or ''}".strip() or sender.email or f"User #{sender.id}"
                        sender_name = f"{name} ({role_label})" if role_label else name
                    else:
                        sender_name = "System"
                    result.append({
                        "id": m.id,
                        "sender_id": m.sender_id,
                        "sender_name": sender_name,
                        "sender_role": sender_role,
                        "is_mine": m.sender_id == int(authorized.id),
                        "message": m.message,
                        "created_at": str(m.created_at),
                    })
                return {"messages": result}

        @self.router.post("/general-chat/send/")
        async def employer_send_general_chat(
            message: str = Query(..., min_length=1),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Отправить сообщение в общий чат верифицированных."""
            from postgres.database import async_session_maker
            from users.models import User, GeneralChatMessage
            if authorized.role not in ['owner', Roles.owner.value]:
                async with async_session_maker() as session:
                    user = await session.get(User, int(authorized.id))
                    if not user or not getattr(user, 'is_employer_verified', False):
                        raise HTTPException(status_code=403, detail="Доступ только для верифицированных")
            async with async_session_maker() as session:
                msg = GeneralChatMessage(sender_id=int(authorized.id), message=message)
                session.add(msg)
                await session.commit()
            return {"sent": True}

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

        @self.router.patch("/{casting_id}/responses/{response_id}/status/")
        async def update_response_status(
            casting_id: int,
            response_id: int,
            data: SResponseStatusUpdate,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Изменить статус отклика актёра (viewed / shortlisted / approved / rejected)."""
            VALID = {"pending", "viewed", "shortlisted", "approved", "rejected"}
            if data.status not in VALID:
                raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(sorted(VALID))}")

            from postgres.database import async_session_maker
            from profiles.models import Response
            from castings.models import Casting
            from sqlalchemy import select

            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Casting not found")
                if str(casting.owner_id) != str(authorized.id) and authorized.role not in ['owner', Roles.owner.value]:
                    from castings.models import ProjectCollaborator
                    collab_check = await session.execute(
                        select(ProjectCollaborator).where(
                            ProjectCollaborator.casting_id == casting_id,
                            ProjectCollaborator.user_id == int(authorized.id),
                        )
                    )
                    if not collab_check.scalar_one_or_none():
                        raise HTTPException(status_code=403, detail="Not your casting")

                resp = await session.get(Response, response_id)
                if not resp or resp.casting_id != casting_id:
                    raise HTTPException(status_code=404, detail="Response not found")

                resp.status = data.status
                await session.commit()

            return {"ok": True, "response_id": response_id, "status": data.status}

        # ──────────────────────────────────────────────
        # Collaborators
        # ──────────────────────────────────────────────

        @self.router.post("/{casting_id}/collaborators/")
        async def add_collaborator(
            casting_id: int,
            user_email: str = Query(..., description="Email пользователя для приглашения"),
            role: str = Query("editor", description="editor или viewer"),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Добавить коллаборанта к проекту."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from users.models import User
            from sqlalchemy import select
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")
                if str(casting.owner_id) != str(authorized.id) and authorized.role not in ['owner', Roles.owner.value]:
                    raise HTTPException(status_code=403, detail="Only project owner can add collaborators")

                user_result = await session.execute(select(User).where(User.email == user_email))
                user = user_result.scalar_one_or_none()
                if not user:
                    raise HTTPException(status_code=404, detail="Пользователь не найден")

                existing = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == casting_id,
                        ProjectCollaborator.user_id == user.id,
                    )
                )
                if existing.scalar_one_or_none():
                    raise HTTPException(status_code=409, detail="Пользователь уже добавлен")

                collab = ProjectCollaborator(casting_id=casting_id, user_id=user.id, role=role)
                session.add(collab)
                await session.commit()
                return {"ok": True, "user_id": user.id, "email": user_email, "role": role}

        @self.router.get("/{casting_id}/collaborators/")
        async def list_collaborators(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Список коллаборантов проекта."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from users.models import User
            from sqlalchemy import select
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")

                result = await session.execute(
                    select(ProjectCollaborator).where(ProjectCollaborator.casting_id == casting_id)
                )
                collabs = result.scalars().all()
                items = []
                for c in collabs:
                    u = await session.get(User, c.user_id)
                    items.append({
                        "id": c.id,
                        "user_id": c.user_id,
                        "email": u.email if u else None,
                        "first_name": getattr(u, 'first_name', None) if u else None,
                        "last_name": getattr(u, 'last_name', None) if u else None,
                        "role": c.role,
                        "created_at": str(c.created_at),
                    })
                return {"collaborators": items, "total": len(items)}

        @self.router.delete("/{casting_id}/collaborators/{collab_id}/")
        async def remove_collaborator(
            casting_id: int,
            collab_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Удалить коллаборанта из проекта."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")
                if str(casting.owner_id) != str(authorized.id) and authorized.role not in ['owner', Roles.owner.value]:
                    raise HTTPException(status_code=403, detail="Only project owner can remove collaborators")

                collab = await session.get(ProjectCollaborator, collab_id)
                if not collab or collab.casting_id != casting_id:
                    raise HTTPException(status_code=404, detail="Collaborator not found")

                await session.delete(collab)
                await session.commit()
                return {"ok": True, "removed_id": collab_id}

        # ──────────────────────────────────────────────
        # Sub-castings (castings inside a project)
        # ──────────────────────────────────────────────

        @self.router.post("/{project_id}/castings/")
        async def create_sub_casting(
            project_id: int,
            title: str = Query(...),
            description: str = Query(""),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Создать кастинг внутри проекта."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from sqlalchemy import select
            async with async_session_maker() as session:
                project = await session.get(Casting, project_id)
                if not project:
                    raise HTTPException(status_code=404, detail="Project not found")

                has_access = (
                    str(project.owner_id) == str(authorized.id) or
                    authorized.role in ['owner', Roles.owner.value]
                )
                if not has_access:
                    collab = await session.execute(
                        select(ProjectCollaborator).where(
                            ProjectCollaborator.casting_id == project_id,
                            ProjectCollaborator.user_id == int(authorized.id),
                        )
                    )
                    if not collab.scalar_one_or_none():
                        raise HTTPException(status_code=403, detail="No access to this project")

                casting = Casting(
                    title=title,
                    description=description,
                    owner_id=int(authorized.id),
                    parent_project_id=project_id,
                )
                session.add(casting)
                await session.flush()
                await session.commit()
                return {
                    "id": casting.id,
                    "title": casting.title,
                    "description": casting.description,
                    "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                    "parent_project_id": project_id,
                    "created_at": str(casting.created_at),
                }

        @self.router.get("/{project_id}/castings/")
        async def list_sub_castings(
            project_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Список кастингов внутри проекта."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from profiles.models import Response
            from sqlalchemy import select, func
            async with async_session_maker() as session:
                project = await session.get(Casting, project_id)
                if not project:
                    raise HTTPException(status_code=404, detail="Project not found")

                has_access = (
                    str(project.owner_id) == str(authorized.id) or
                    authorized.role in ['owner', Roles.owner.value]
                )
                if not has_access:
                    collab = await session.execute(
                        select(ProjectCollaborator).where(
                            ProjectCollaborator.casting_id == project_id,
                            ProjectCollaborator.user_id == int(authorized.id),
                        )
                    )
                    if not collab.scalar_one_or_none():
                        raise HTTPException(status_code=403, detail="No access to this project")

                result = await session.execute(
                    select(Casting).where(Casting.parent_project_id == project_id)
                    .order_by(Casting.created_at.desc())
                )
                castings = result.scalars().all()

                items = []
                for c in castings:
                    resp_count = (await session.execute(
                        select(func.count()).where(Response.casting_id == c.id)
                    )).scalar() or 0
                    items.append({
                        "id": c.id,
                        "title": c.title,
                        "description": c.description,
                        "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                        "response_count": resp_count,
                        "created_at": str(c.created_at),
                    })

                return {"castings": items, "total": len(items)}

        # ──────────────────────────────────────────────
        # Project Chat
        # ──────────────────────────────────────────────

        @self.router.get("/{casting_id}/chat/")
        async def get_project_chat(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Чат проекта — только для владельца, коллабораторов и SuperAdmin."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from users.models import User, ProjectChatMessage
            from sqlalchemy import select

            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")

                user_id = int(authorized.id)
                role = authorized.role
                has_access = (
                    str(casting.owner_id) == str(user_id) or
                    role in ['owner', Roles.owner.value]
                )
                if not has_access:
                    collab = await session.execute(
                        select(ProjectCollaborator).where(
                            ProjectCollaborator.casting_id == casting_id,
                            ProjectCollaborator.user_id == user_id,
                        )
                    )
                    if not collab.scalar_one_or_none():
                        raise HTTPException(status_code=403, detail="No access to this project chat")

                msgs = await session.execute(
                    select(ProjectChatMessage).where(
                        ProjectChatMessage.casting_id == casting_id
                    ).order_by(ProjectChatMessage.created_at.asc()).limit(200)
                )
                messages = msgs.scalars().all()

                result = []
                for m in messages:
                    sender = await session.get(User, m.sender_id) if m.sender_id else None
                    sender_name = "Система"
                    sender_role = "system"
                    if sender:
                        sender_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip() or sender.email or f"User #{sender.id}"
                        sender_role = sender.role.value if hasattr(sender.role, 'value') else str(sender.role)
                    result.append({
                        "id": m.id,
                        "sender_id": m.sender_id,
                        "sender_name": sender_name,
                        "sender_role": sender_role,
                        "message": m.message,
                        "created_at": str(m.created_at),
                    })

                return {"messages": result}

        @self.router.post("/{casting_id}/chat/")
        async def send_project_chat(
            casting_id: int,
            message: str = Query(..., min_length=1, max_length=2000),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Отправить сообщение в чат проекта."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from users.models import ProjectChatMessage
            from sqlalchemy import select

            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")

                user_id = int(authorized.id)
                role = authorized.role
                has_access = (
                    str(casting.owner_id) == str(user_id) or
                    role in ['owner', Roles.owner.value]
                )
                if not has_access:
                    collab = await session.execute(
                        select(ProjectCollaborator).where(
                            ProjectCollaborator.casting_id == casting_id,
                            ProjectCollaborator.user_id == user_id,
                        )
                    )
                    if not collab.scalar_one_or_none():
                        raise HTTPException(status_code=403, detail="No access to this project chat")

                msg = ProjectChatMessage(
                    casting_id=casting_id,
                    sender_id=user_id,
                    message=message,
                )
                session.add(msg)
                await session.commit()

                return {"ok": True, "message_id": msg.id}


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
                            "middle_name": getattr(u, 'middle_name', None),
                            "email": u.email,
                            "phone_number": getattr(u, 'phone_number', None),
                            "telegram_username": u.telegram_username,
                            "telegram_nick": getattr(u, 'telegram_nick', None),
                            "vk_nick": getattr(u, 'vk_nick', None),
                            "max_nick": getattr(u, 'max_nick', None),
                            "photo_url": getattr(u, 'photo_url', None),
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
            """SuperAdmin: все актёры — пользователи с ролью user/agent + их профили."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from sqlalchemy import select, func
            from sqlalchemy.orm import selectinload
            from users.models import User, ActorProfile
            from users.enums import ModelRoles
            from profiles.models import Profile

            results = []
            async with async_session_maker() as session:
                user_q = (
                    select(User)
                    .where(User.role.in_([ModelRoles.user, ModelRoles.agent]))
                    .order_by(User.id.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
                actor_users = (await session.execute(user_q)).scalars().all()

                for u in actor_users:
                    ap_result = await session.execute(
                        select(ActorProfile).where(
                            ActorProfile.user_id == u.id,
                            ActorProfile.is_deleted == False,
                        )
                    )
                    profiles_list = ap_result.scalars().all()

                    role_str = u.role.value if hasattr(u.role, 'value') else str(u.role)

                    if profiles_list:
                        for p in profiles_list:
                            media = [
                                {
                                    "id": m.id,
                                    "file_type": m.file_type,
                                    "original_url": m.original_url,
                                    "processed_url": m.processed_url,
                                    "thumbnail_url": m.thumbnail_url,
                                    "is_primary": m.is_primary,
                                }
                                for m in (p.media_assets or [])
                            ]
                            primary_photo = next((m["processed_url"] or m["original_url"] for m in media if m["file_type"] == "photo" and m.get("is_primary")), None)
                            results.append({
                                "profile_id": p.id,
                                "user_id": u.id,
                                "source": "actor_profiles",
                                "first_name": p.first_name or u.first_name,
                                "last_name": p.last_name or u.last_name,
                                "display_name": p.display_name,
                                "gender": p.gender,
                                "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
                                "city": p.city,
                                "phone_number": p.phone_number or u.phone_number,
                                "email": p.email or u.email,
                                "qualification": p.qualification,
                                "experience": p.experience,
                                "about_me": p.about_me,
                                "look_type": p.look_type,
                                "hair_color": p.hair_color,
                                "hair_length": p.hair_length,
                                "height": p.height,
                                "clothing_size": p.clothing_size,
                                "shoe_size": p.shoe_size,
                                "bust_volume": p.bust_volume,
                                "waist_volume": p.waist_volume,
                                "hip_volume": p.hip_volume,
                                "video_intro": p.video_intro,
                                "trust_score": p.trust_score,
                                "owner_role": role_str,
                                "owner_name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
                                "photo_url": primary_photo or u.photo_url,
                                "media_assets": media,
                                "has_profile": True,
                                "created_at": str(p.created_at),
                            })
                    else:
                        results.append({
                            "profile_id": None,
                            "user_id": u.id,
                            "source": "user",
                            "first_name": u.first_name,
                            "last_name": u.last_name,
                            "display_name": None,
                            "gender": None,
                            "date_of_birth": None,
                            "city": None,
                            "qualification": None,
                            "experience": None,
                            "about_me": None,
                            "look_type": None,
                            "hair_color": None,
                            "hair_length": None,
                            "height": None,
                            "clothing_size": None,
                            "shoe_size": None,
                            "bust_volume": None,
                            "waist_volume": None,
                            "hip_volume": None,
                            "video_intro": None,
                            "trust_score": 0,
                            "phone_number": u.phone_number,
                            "email": u.email,
                            "owner_role": role_str,
                            "owner_name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
                            "photo_url": u.photo_url,
                            "media_assets": [],
                            "has_profile": False,
                            "created_at": str(u.created_at),
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
                            "response_id": r.id,
                            "first_name": p.first_name,
                            "last_name": p.last_name,
                            "responded_at": str(r.created_at),
                            "is_shortlisted": shortlist_cnt > 0,
                            "response_status": getattr(r, 'status', 'pending') or 'pending',
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
                        "middle_name": getattr(user, 'middle_name', None),
                        "email": user.email,
                        "phone_number": getattr(user, 'phone_number', None),
                        "telegram_username": getattr(user, 'telegram_username', None),
                        "telegram_nick": getattr(user, 'telegram_nick', None),
                        "vk_nick": getattr(user, 'vk_nick', None),
                        "max_nick": getattr(user, 'max_nick', None),
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
                            "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
                            "city": p.city,
                            "phone_number": p.phone_number,
                            "email": p.email,
                            "qualification": p.qualification,
                            "experience": p.experience,
                            "about_me": p.about_me,
                            "look_type": p.look_type,
                            "hair_color": p.hair_color,
                            "hair_length": p.hair_length,
                            "height": p.height,
                            "clothing_size": p.clothing_size,
                            "shoe_size": p.shoe_size,
                            "bust_volume": p.bust_volume,
                            "waist_volume": p.waist_volume,
                            "hip_volume": p.hip_volume,
                            "video_intro": p.video_intro,
                            "trust_score": p.trust_score,
                            "media_assets": [
                                {
                                    "id": m.id,
                                    "file_type": m.file_type,
                                    "original_url": m.original_url,
                                    "processed_url": m.processed_url,
                                    "thumbnail_url": m.thumbnail_url,
                                    "is_primary": m.is_primary,
                                }
                                for m in (p.media_assets or [])
                            ],
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
            from users.models import User, VerificationTicket
            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.is_employer_verified = True
                from sqlalchemy import select, update
                await session.execute(
                    update(VerificationTicket)
                    .where(VerificationTicket.user_id == user_id, VerificationTicket.status == 'open')
                    .values(status='approved')
                )
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
            from users.models import User, VerificationTicket
            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                user.is_employer_verified = False
                from sqlalchemy import update
                await session.execute(
                    update(VerificationTicket)
                    .where(VerificationTicket.user_id == user_id, VerificationTicket.status == 'approved')
                    .values(status='rejected')
                )
                await session.commit()
            return {"verified": False, "user_id": user_id}

        # ──────────────────────────────────────────────
        # Verification Tickets
        # ──────────────────────────────────────────────

        @self.router.get("/tickets/")
        async def list_tickets(
            status: Optional[str] = Query(None),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: список всех тикетов верификации."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User, VerificationTicket, TicketMessage
            from sqlalchemy import select, func, text
            try:
                async with async_session_maker() as session:
                    tbl = await session.execute(text(
                        "SELECT to_regclass('public.verification_tickets')"
                    ))
                    if tbl.scalar() is None:
                        return {"tickets": [], "total": 0, "warning": "table_missing"}

                    q = select(VerificationTicket).order_by(VerificationTicket.created_at.desc())
                    if status:
                        q = q.where(VerificationTicket.status == status)
                    tickets = (await session.execute(q)).scalars().all()

                    result = []
                    for t in tickets:
                        user = await session.get(User, t.user_id)
                        msg_count = (await session.execute(
                            select(func.count(TicketMessage.id)).where(TicketMessage.ticket_id == t.id)
                        )).scalar() or 0
                        last_msg = (await session.execute(
                            select(TicketMessage).where(TicketMessage.ticket_id == t.id)
                            .order_by(TicketMessage.created_at.desc()).limit(1)
                        )).scalar_one_or_none()

                        result.append({
                            "id": t.id,
                            "user_id": t.user_id,
                            "status": t.status,
                            "company_name": t.company_name,
                            "about_text": t.about_text,
                            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else '—',
                            "user_email": user.email if user else None,
                            "user_role": (user.role.value if hasattr(user.role, 'value') else str(user.role)) if user else None,
                            "message_count": msg_count,
                            "last_message": last_msg.message[:100] if last_msg else None,
                            "last_message_at": str(last_msg.created_at) if last_msg else None,
                            "created_at": str(t.created_at),
                        })
                    return {"tickets": result, "total": len(result)}
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"tickets error: {str(e)}")

        @self.router.get("/tickets/{ticket_id}/")
        async def get_ticket_detail(
            ticket_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: детали тикета с сообщениями."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User, VerificationTicket, TicketMessage
            from sqlalchemy import select
            async with async_session_maker() as session:
                ticket = await session.get(VerificationTicket, ticket_id)
                if not ticket:
                    raise HTTPException(status_code=404, detail="Ticket not found")

                user = await session.get(User, ticket.user_id)
                msgs_q = select(TicketMessage).where(
                    TicketMessage.ticket_id == ticket_id
                ).order_by(TicketMessage.created_at.asc())
                msgs = (await session.execute(msgs_q)).scalars().all()

                messages = []
                for m in msgs:
                    sender = await session.get(User, m.sender_id) if m.sender_id else None
                    sender_role = (sender.role.value if hasattr(sender.role, 'value') else str(sender.role)) if sender else None
                    if sender_role == 'owner':
                        sender_name = "👑 SuperAdmin"
                    elif sender:
                        sender_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip() or sender.email or f"User #{sender.id}"
                    else:
                        sender_name = "System"
                    messages.append({
                        "id": m.id,
                        "sender_id": m.sender_id,
                        "sender_name": sender_name,
                        "sender_role": sender_role,
                        "message": m.message,
                        "created_at": str(m.created_at),
                    })

                return {
                    "ticket": {
                        "id": ticket.id,
                        "user_id": ticket.user_id,
                        "status": ticket.status,
                        "company_name": ticket.company_name,
                        "about_text": ticket.about_text,
                        "projects_text": ticket.projects_text,
                        "experience_text": ticket.experience_text,
                        "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else '—',
                        "user_email": user.email if user else None,
                        "user_role": (user.role.value if hasattr(user.role, 'value') else str(user.role)) if user else None,
                        "is_verified": getattr(user, 'is_employer_verified', False) if user else False,
                        "created_at": str(ticket.created_at),
                    },
                    "messages": messages,
                }

        @self.router.post("/tickets/{ticket_id}/message/")
        async def send_ticket_message(
            ticket_id: int,
            message: str = Query(..., min_length=1),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: отправить сообщение в тикет."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import VerificationTicket, TicketMessage
            async with async_session_maker() as session:
                ticket = await session.get(VerificationTicket, ticket_id)
                if not ticket:
                    raise HTTPException(status_code=404, detail="Ticket not found")
                msg = TicketMessage(
                    ticket_id=ticket_id,
                    sender_id=int(authorized.id),
                    message=message,
                )
                session.add(msg)
                await session.commit()
                await session.refresh(msg)
            return {"id": msg.id, "sent": True}

        @self.router.post("/tickets/{ticket_id}/approve/")
        async def approve_ticket(
            ticket_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: одобрить тикет (верифицировать employer)."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User, VerificationTicket, TicketMessage
            async with async_session_maker() as session:
                ticket = await session.get(VerificationTicket, ticket_id)
                if not ticket:
                    raise HTTPException(status_code=404, detail="Ticket not found")
                ticket.status = 'approved'
                user = await session.get(User, ticket.user_id)
                if user:
                    user.is_employer_verified = True
                msg = TicketMessage(
                    ticket_id=ticket_id,
                    sender_id=int(authorized.id),
                    message="✅ Верификация одобрена. Доступ к публикации проектов открыт.",
                )
                session.add(msg)
                await session.commit()
            return {"approved": True, "ticket_id": ticket_id}

        @self.router.post("/tickets/{ticket_id}/reject/")
        async def reject_ticket(
            ticket_id: int,
            reason: str = Query("", description="Причина отказа"),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: отклонить тикет."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import VerificationTicket, TicketMessage
            async with async_session_maker() as session:
                ticket = await session.get(VerificationTicket, ticket_id)
                if not ticket:
                    raise HTTPException(status_code=404, detail="Ticket not found")
                ticket.status = 'rejected'
                msg_text = f"❌ Верификация отклонена."
                if reason:
                    msg_text += f" Причина: {reason}"
                msg = TicketMessage(
                    ticket_id=ticket_id,
                    sender_id=int(authorized.id),
                    message=msg_text,
                )
                session.add(msg)
                await session.commit()
            return {"rejected": True, "ticket_id": ticket_id}

        # ──────────────────────────────────────────────
        # General Chat (verified admins + SuperAdmin)
        # ──────────────────────────────────────────────

        @self.router.get("/general-chat/")
        async def get_general_chat(
            page_size: int = Query(50, gt=0),
            authorized: JWT = Depends(admin_authorized),
        ):
            """Общий чат верифицированных админов и SuperAdmin."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User, GeneralChatMessage
            from sqlalchemy import select
            async with async_session_maker() as session:
                q = select(GeneralChatMessage).order_by(
                    GeneralChatMessage.created_at.desc()
                ).limit(page_size)
                msgs = (await session.execute(q)).scalars().all()
                result = []
                for m in reversed(msgs):
                    sender = await session.get(User, m.sender_id) if m.sender_id else None
                    sender_role = (sender.role.value if hasattr(sender.role, 'value') else str(sender.role)) if sender else None
                    if sender_role == 'owner':
                        sender_name = "👑 SuperAdmin"
                    elif sender:
                        sender_name = f"{sender.first_name or ''} {sender.last_name or ''}".strip() or sender.email or f"User #{sender.id}"
                    else:
                        sender_name = "System"
                    result.append({
                        "id": m.id,
                        "sender_id": m.sender_id,
                        "sender_name": sender_name,
                        "sender_role": sender_role,
                        "message": m.message,
                        "created_at": str(m.created_at),
                    })
                return {"messages": result}

        @self.router.post("/general-chat/")
        async def send_general_chat(
            message: str = Query(..., min_length=1),
            authorized: JWT = Depends(admin_authorized),
        ):
            """Отправить сообщение в общий чат."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                from postgres.database import async_session_maker as sm
                from users.models import User
                async with sm() as session:
                    user = await session.get(User, int(authorized.id))
                    if not user or not getattr(user, 'is_employer_verified', False):
                        raise HTTPException(status_code=403, detail="Only verified employers and SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import GeneralChatMessage
            async with async_session_maker() as session:
                msg = GeneralChatMessage(
                    sender_id=int(authorized.id),
                    message=message,
                )
                session.add(msg)
                await session.commit()
                await session.refresh(msg)
            return {"id": msg.id, "sent": True}

        @self.router.post("/users/{user_id}/set-role/")
        async def set_user_role(
            user_id: int,
            role: str = Query(..., description="Role to assign: user, agent, employer, employer_pro, owner"),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: назначить роль любому пользователю (бесплатно)."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            VALID_ROLES = {'user', 'agent', 'employer', 'employer_pro', 'owner'}
            if role not in VALID_ROLES:
                raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}")

            from postgres.database import async_session_maker
            from users.models import User
            from users.enums import ModelRoles
            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")

                try:
                    user.role = ModelRoles(role)
                except ValueError:
                    user.role = role

                user.is_active = True
                await session.commit()

            from users.services.auth_token.service import TokenService
            new_token = TokenService.generate_access_token(
                user_id=str(user_id),
                profile_id="0",
                role=role,
            )

            return {"ok": True, "user_id": user_id, "new_role": role, "access_token": str(new_token)}
