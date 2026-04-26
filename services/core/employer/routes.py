"""
Employer & Actor Routes — разделение прав по ролям.

SuperAdmin (owner): полный доступ, удаление любых анкет/проектов.
Admin/Employer: CRUD своих проектов, просмотр только откликнувшихся актёров.
Actor (user): профиль, лента проектов, отклики, история.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Body, Request, UploadFile, File
from typing import Optional
import base64
import hashlib
import hmac
import json
import time
from datetime import datetime, timezone

from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import admin_authorized, tma_authorized, employer_authorized
from users.enums import Roles
from employer.service import EmployerService, ActorFeedService
from crm.models import NotificationType
from crm.service import NotificationService
from employer.schemas import (
    SProjectCreate, SProjectUpdate, SProjectData, SProjectList,
    SRespondentsList, SActorResponseCreate, SActorResponse, SActorResponseHistory,
    SResponseStatusUpdate, SAgentBulkResponseCreate,
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

        def _user_role_value(user) -> Optional[str]:
            if not user or getattr(user, 'role', None) is None:
                return None
            return user.role.value if hasattr(user.role, 'value') else str(user.role)

        def _sign_invite_payload(payload: dict) -> str:
            from config import settings
            raw = json.dumps(payload, separators=(',', ':'), ensure_ascii=True).encode('utf-8')
            encoded = base64.urlsafe_b64encode(raw).decode('utf-8').rstrip('=')
            signature = hmac.new(
                settings.SECRET_KEY.encode('utf-8'),
                encoded.encode('utf-8'),
                hashlib.sha256,
            ).hexdigest()
            return f"{encoded}.{signature}"

        def _decode_invite_token(token: str) -> dict:
            from config import settings
            try:
                encoded, signature = token.split('.', 1)
            except ValueError:
                raise HTTPException(status_code=400, detail="Некорректная ссылка приглашения")
            expected = hmac.new(
                settings.SECRET_KEY.encode('utf-8'),
                encoded.encode('utf-8'),
                hashlib.sha256,
            ).hexdigest()
            if not hmac.compare_digest(signature, expected):
                raise HTTPException(status_code=400, detail="Некорректная ссылка приглашения")
            padded = encoded + '=' * (-len(encoded) % 4)
            try:
                payload = json.loads(base64.urlsafe_b64decode(padded.encode('utf-8')).decode('utf-8'))
            except Exception:
                raise HTTPException(status_code=400, detail="Некорректная ссылка приглашения")
            if payload.get('kind') != 'project_collab_invite':
                raise HTTPException(status_code=400, detail="Некорректный тип приглашения")
            expires_at = int(payload.get('exp', 0))
            if expires_at and expires_at < int(time.time()):
                raise HTTPException(status_code=400, detail="Срок действия ссылки истёк")
            return payload

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
            authorized: JWT = Depends(tma_authorized),
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
            authorized: JWT = Depends(tma_authorized),
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
                    try:
                        requester_name = f"User #{authorized.id}"
                        await NotificationService.notify_superadmins(
                            type=NotificationType.SYSTEM,
                            title="Новая заявка на верификацию",
                            message=(
                                f"{requester_name} отправил заявку"
                                + (f" от компании {company_name}" if company_name else "")
                            ),
                        )
                    except Exception:
                        pass
                    return {"ticket_id": ticket.id, "status": "open"}
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"verification-request error: {str(e)}")

        @self.router.get("/my-ticket/")
        async def get_my_ticket(
            authorized: JWT = Depends(tma_authorized),
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
            authorized: JWT = Depends(tma_authorized),
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

        # ──────────────────────────────────────────────
        # Поддержка — чат с SuperAdmin, доступен любой роли
        # Используем те же таблицы verification_tickets / ticket_messages,
        # маркер: company_name == '__SUPPORT__'
        # ──────────────────────────────────────────────
        SUPPORT_MARKER = '__SUPPORT__'

        @self.router.get("/support/my/")
        async def get_my_support_ticket(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Получить свой support-тикет с историей сообщений."""
            from postgres.database import async_session_maker
            from users.models import User, VerificationTicket, TicketMessage
            from sqlalchemy import select
            async with async_session_maker() as session:
                ticket = (await session.execute(
                    select(VerificationTicket)
                    .where(
                        VerificationTicket.user_id == int(authorized.id),
                        VerificationTicket.company_name == SUPPORT_MARKER,
                    )
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
                        sender_name = "👑 Поддержка"
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

        @self.router.post("/support/message/")
        async def send_support_message(
            message: str = Query(..., min_length=1),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Отправить сообщение в поддержку. Создаёт тикет при первом обращении."""
            from postgres.database import async_session_maker
            from users.models import VerificationTicket, TicketMessage, User
            from sqlalchemy import select
            from crm.service import NotificationService
            from crm.models import NotificationType

            async with async_session_maker() as session:
                ticket = (await session.execute(
                    select(VerificationTicket)
                    .where(
                        VerificationTicket.user_id == int(authorized.id),
                        VerificationTicket.company_name == SUPPORT_MARKER,
                    )
                    .order_by(VerificationTicket.created_at.desc()).limit(1)
                )).scalar_one_or_none()

                if not ticket:
                    ticket = VerificationTicket(
                        user_id=int(authorized.id),
                        status='open',
                        company_name=SUPPORT_MARKER,
                        about_text='Обращение в поддержку',
                    )
                    session.add(ticket)
                    await session.flush()

                # Если был закрыт — реактивируем
                if ticket.status in ('approved', 'rejected', 'closed'):
                    ticket.status = 'open'

                msg = TicketMessage(
                    ticket_id=ticket.id,
                    sender_id=int(authorized.id),
                    message=message,
                )
                session.add(msg)
                await session.commit()
                await session.refresh(msg)
                await session.refresh(ticket)

                # Уведомляем всех SuperAdmin-ов
                try:
                    user = await session.get(User, int(authorized.id))
                    sender_name = (
                        f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
                        if user else f"User #{authorized.id}"
                    ) or (user.email if user else f"User #{authorized.id}")
                    await NotificationService.notify_superadmins(
                        type=NotificationType.SYSTEM,
                        title="💬 Новое сообщение в поддержку",
                        message=f"От {sender_name}: {message[:140]}",
                    )
                except Exception:
                    pass

                return {
                    "sent": True,
                    "ticket_id": ticket.id,
                    "message_id": msg.id,
                }

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
            archived: bool = Query(False, description="Показывать архивные проекты"),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Список моих проектов (employer видит только свои, superadmin — все)."""
            return await EmployerService.get_my_projects(
                user_token=authorized, page=page, page_size=page_size, archived=archived
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

        @self.router.post("/{casting_id}/archive/", response_model=SProjectData)
        async def archive_project(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Переместить проект в архив."""
            return await EmployerService.set_project_archived(
                user_token=authorized, casting_id=casting_id, archived=True
            )

        @self.router.post("/{casting_id}/restore/", response_model=SProjectData)
        async def restore_project(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Вернуть проект из архива."""
            return await EmployerService.set_project_archived(
                user_token=authorized, casting_id=casting_id, archived=False
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

        @self.router.post("/{casting_id}/unpublish/", response_model=SProjectData)
        async def unpublish_project(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Снять проект с публикации."""
            return await EmployerService.unpublish_project(
                user_token=authorized, casting_id=casting_id
            )

        @self.router.post("/{casting_id}/finish/", response_model=SProjectData)
        async def finish_project(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Завершить кастинг."""
            return await EmployerService.finish_project(
                user_token=authorized, casting_id=casting_id
            )

        @self.router.post("/{casting_id}/upload-image/")
        async def upload_casting_image(
            casting_id: int,
            image: UploadFile = File(...),
            request: Request = None,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Загрузить фото для кастинга."""
            return await EmployerService.upload_casting_image(
                user_token=authorized,
                casting_id=casting_id,
                image=image,
                base_url=str(request.base_url).rstrip("/") if request else "",
            )

        @self.router.post("/{casting_id}/upload-image-json/")
        async def upload_casting_image_json(
            casting_id: int,
            body: dict = Body(...),
            request: Request = None,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Загрузить фото для кастинга через JSON/base64."""
            return await EmployerService.upload_casting_image_base64(
                user_token=authorized,
                casting_id=casting_id,
                image_base64=body.get("image_base64", ""),
                base_url=str(request.base_url).rstrip("/") if request else "",
            )

        @self.router.delete("/{casting_id}/delete-image/")
        async def delete_casting_image(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Удалить фото кастинга."""
            return await EmployerService.delete_casting_image(
                user_token=authorized, casting_id=casting_id
            )

        @self.router.get("/{casting_id}/detail/")
        async def get_project_detail(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Получить данные одного проекта/кастинга по ID."""
            return await EmployerService.get_project_by_id(
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

                # Notify agent if their actor was approved/shortlisted
                if data.status in ('approved', 'shortlisted'):
                    try:
                        from profiles.models import Profile as _Profile
                        actor_legacy = await session.get(_Profile, resp.profile_id)
                        if actor_legacy and actor_legacy.user_id:
                            from users.models import User as _U
                            actor_owner = await session.get(_U, actor_legacy.user_id)
                            role_val = actor_owner.role.value if actor_owner and hasattr(actor_owner.role, 'value') else str(getattr(actor_owner, 'role', ''))
                            if role_val == 'agent':
                                status_label = 'одобрен' if data.status == 'approved' else 'добавлен в избранное'
                                actor_name = f"{actor_legacy.first_name or ''} {actor_legacy.last_name or ''}".strip() or "Ваш актёр"
                                await NotificationService.create(
                                    user_id=actor_legacy.user_id,
                                    type=NotificationType.SYSTEM,
                                    title=f"🎉 {actor_name} {status_label}!",
                                    message=f"Актёр {actor_name} был {status_label} в кастинге «{casting.title}».",
                                    casting_id=casting_id,
                                )
                    except Exception:
                        pass

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
            if role not in {"editor", "viewer"}:
                raise HTTPException(status_code=400, detail="Роль участника должна быть editor или viewer")
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from users.models import User
            from sqlalchemy import select
            from employer.subscription import Subscription
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

                inviter_is_superadmin = authorized.role in ['owner', Roles.owner.value]
                target_role = _user_role_value(user)
                if target_role not in [Roles.employer.value, Roles.employer_pro.value]:
                    raise HTTPException(
                        status_code=403,
                        detail=(
                            "Вручную можно добавить только Админа или Админа ПРО. "
                            "Для команды SuperAdmin без подписки используйте пригласительную ссылку."
                            if inviter_is_superadmin
                            else "В проект можно добавить только Админа или Админа ПРО с активной подпиской"
                        ),
                    )
                if not inviter_is_superadmin:
                    sub_result = await session.execute(
                        select(Subscription)
                        .where(
                            Subscription.user_id == user.id,
                            Subscription.is_active == True,
                        )
                        .order_by(Subscription.created_at.desc())
                        .limit(1)
                    )
                    subscription = sub_result.scalar_one_or_none()
                    is_active_subscription = bool(
                        subscription and getattr(subscription, 'expires_at', None) and subscription.expires_at >= datetime.now(timezone.utc)
                    )
                    if not is_active_subscription:
                        raise HTTPException(
                            status_code=403,
                            detail="У приглашённого Админа должна быть активная подписка",
                        )

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

        @self.router.post("/{casting_id}/collaborators/invite-link/")
        async def create_collaborator_invite_link(
            casting_id: int,
            role: str = Query("editor", description="editor или viewer"),
            expires_in_hours: int = Query(72, gt=1, le=720),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Сгенерировать пригласительную ссылку в команду проекта (только SuperAdmin)."""
            if role not in {"editor", "viewer"}:
                raise HTTPException(status_code=400, detail="Роль участника должна быть editor или viewer")
            from postgres.database import async_session_maker
            from castings.models import Casting
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")
                if authorized.role not in ['owner', Roles.owner.value]:
                    raise HTTPException(status_code=403, detail="Только SuperAdmin может создавать пригласительные ссылки")
                payload = {
                    "kind": "project_collab_invite",
                    "casting_id": int(casting_id),
                    "role": role,
                    "created_by": int(authorized.id),
                    "exp": int(time.time()) + expires_in_hours * 3600,
                }
                token = _sign_invite_payload(payload)
                return {"ok": True, "token": token, "casting_id": int(casting_id), "role": role, "expires_in_hours": expires_in_hours}

        @self.router.post("/collaborators/accept-invite/")
        async def accept_collaborator_invite(
            token: str = Query(..., description="Токен приглашения"),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Принять приглашение в команду проекта любым авторизованным пользователем."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from sqlalchemy import select
            async with async_session_maker() as session:
                payload = _decode_invite_token(token)
                casting_id = int(payload.get('casting_id'))
                role = payload.get('role') or 'editor'
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")
                if str(casting.owner_id) == str(authorized.id):
                    raise HTTPException(status_code=409, detail="Вы уже являетесь владельцем этого проекта")
                existing = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == casting_id,
                        ProjectCollaborator.user_id == int(authorized.id),
                    )
                )
                collab = existing.scalar_one_or_none()
                if collab:
                    return {"ok": True, "casting_id": casting_id, "role": collab.role, "already_joined": True}
                session.add(ProjectCollaborator(
                    casting_id=casting_id,
                    user_id=int(authorized.id),
                    role=role,
                ))
                await session.commit()
                return {"ok": True, "casting_id": casting_id, "role": role, "already_joined": False}

        @self.router.get("/{casting_id}/collaborators/")
        async def list_collaborators(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
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
                    user_role = _user_role_value(u)
                    items.append({
                        "id": c.id,
                        "user_id": c.user_id,
                        "email": u.email if u else None,
                        "first_name": getattr(u, 'first_name', None) if u else None,
                        "last_name": getattr(u, 'last_name', None) if u else None,
                        "user_role": user_role,
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
            body: dict = Body(...),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Создать кастинг внутри проекта."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from sqlalchemy import select

            title = (body.get("title") or "").strip()
            if not title:
                raise HTTPException(status_code=422, detail="Заголовок обязателен")

            try:
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

                    from castings.enums import CastingStatusEnum
                    casting = Casting(
                        title=title,
                        description=body.get("description") or "-",
                        owner_id=int(authorized.id),
                        parent_project_id=project_id,
                        status=CastingStatusEnum.published,
                        city=body.get("city") or None,
                        project_category=body.get("project_category") or None,
                        role_types=body.get("role_types") or None,
                        gender=body.get("gender") or None,
                        age_from=body.get("age_from"),
                        age_to=body.get("age_to"),
                        financial_conditions=body.get("financial_conditions") or None,
                        shooting_dates=body.get("shooting_dates") or None,
                    )
                    casting.published_by_id = int(authorized.id)
                    session.add(casting)
                    await session.flush()
                    await session.commit()
                    await session.refresh(casting)

                    try:
                        creator = await session.get(User, int(authorized.id))
                        creator_name = EmployerService._display_user_name(creator, f"User #{authorized.id}")
                        await NotificationService.notify_superadmins(
                            type=NotificationType.CASTING_PUBLISHED,
                            title="Кастинг опубликован",
                            message=f"🎬 {creator_name} создал кастинг «{casting.title}» в проекте «{project.title}».",
                            casting_id=casting.id,
                            exclude_user_id=int(authorized.id),
                        )
                        await NotificationService.notify_project_team(
                            casting_id=casting.id,
                            type=NotificationType.CASTING_PUBLISHED,
                            title="Кастинг создан",
                            message=f"🎬 {creator_name} создал кастинг «{casting.title}» в проекте «{project.title}».",
                            exclude_user_id=int(authorized.id),
                        )
                    except Exception:
                        pass

                    return {
                        "id": casting.id,
                        "title": casting.title,
                        "description": casting.description,
                        "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                        "parent_project_id": project_id,
                        "created_at": str(casting.created_at or ''),
                        "city": casting.city,
                        "project_category": casting.project_category,
                        "role_types": casting.role_types,
                        "gender": casting.gender,
                        "age_from": casting.age_from,
                        "age_to": casting.age_to,
                        "financial_conditions": casting.financial_conditions,
                        "shooting_dates": casting.shooting_dates,
                    }
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}")

        @self.router.get("/{project_id}/castings/")
        async def list_sub_castings(
            project_id: int,
            authorized: JWT = Depends(tma_authorized),
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
                castings = result.unique().scalars().all()

                items = []
                for c in castings:
                    resp_count = (await session.execute(
                        select(func.count()).where(Response.casting_id == c.id)
                    )).scalar() or 0
                    image_url = await EmployerService._get_casting_image_url(session, c.id, casting=c)
                    items.append({
                        "id": c.id,
                        "title": c.title,
                        "description": c.description,
                        "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                        "response_count": resp_count,
                        "created_at": str(c.created_at),
                        "image_url": image_url,
                        "city": c.city,
                        "project_category": c.project_category,
                        "role_types": c.role_types,
                        "gender": c.gender,
                        "age_from": c.age_from,
                        "age_to": c.age_to,
                        "financial_conditions": c.financial_conditions,
                        "shooting_dates": c.shooting_dates,
                    })

                return {"castings": items, "total": len(items)}

        # ──────────────────────────────────────────────
        # Project Chat
        # ──────────────────────────────────────────────

        @self.router.get("/{casting_id}/chat/")
        async def get_project_chat(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
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
            authorized: JWT = Depends(tma_authorized),
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

        @self.router.get("/by-profile/{profile_id}/")
        async def get_actor_by_profile_id(
            profile_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Получить анкету актёра по Profile.id (для карточки в отчёте)."""
            from postgres.database import async_session_maker
            from profiles.models import Profile
            from users.models import ActorProfile, User
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload
            async with async_session_maker() as session:
                p = await session.get(Profile, profile_id)
                if not p:
                    raise HTTPException(status_code=404, detail="Profile not found")

                # Найдём актуальный ActorProfile того же пользователя
                ap = None
                if p.user_id:
                    ap_res = await session.execute(
                        select(ActorProfile)
                        .options(selectinload(ActorProfile.media_assets))
                        .where(
                            ActorProfile.user_id == p.user_id,
                            ActorProfile.is_deleted == False,
                        )
                        .order_by(ActorProfile.created_at.desc())
                        .limit(1)
                    )
                    ap = ap_res.unique().scalar_one_or_none()

                media = []
                ap_photo = None
                ap_photo_fallback = None
                if ap and ap.media_assets:
                    for m in ap.media_assets:
                        media.append({
                            "id": m.id,
                            "file_type": m.file_type,
                            "original_url": m.original_url,
                            "processed_url": m.processed_url,
                            "thumbnail_url": m.thumbnail_url,
                            "is_primary": m.is_primary,
                        })
                        if m.file_type == 'photo':
                            if m.is_primary:
                                ap_photo = m.processed_url or m.original_url
                            elif ap_photo_fallback is None:
                                ap_photo_fallback = m.processed_url or m.original_url

                legacy_photo = None
                if hasattr(p, 'images') and p.images:
                    legacy_photo = p.images[0].crop_photo_url or p.images[0].photo_url

                owner_user = await session.get(User, p.user_id) if p.user_id else None
                agent_name = None
                has_agent = False
                if owner_user:
                    owner_role = owner_user.role.value if hasattr(owner_user.role, 'value') else str(owner_user.role)
                    if owner_role == 'agent':
                        has_agent = True
                        parts = [x for x in [owner_user.first_name, owner_user.last_name] if x]
                        agent_name = ' '.join(parts) if parts else (owner_user.email or 'Агент')

                from datetime import datetime
                age = None
                if p.date_of_birth:
                    today = datetime.now().date()
                    dob = p.date_of_birth
                    if hasattr(dob, 'date'):
                        dob = dob.date()
                    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

                return {
                    "profile_id": p.id,
                    "actor_profile_id": ap.id if ap else None,
                    "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                    "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                    "display_name": ap.display_name if ap else None,
                    "gender": p.gender.value if hasattr(p.gender, 'value') else (str(p.gender) if p.gender else (ap.gender if ap else None)),
                    "age": age,
                    "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
                    "city": (ap.city if ap and ap.city else None) or (str(p.city_full) if p.city_full else None),
                    "height": ap.height if ap else (float(p.height) if p.height else None),
                    "clothing_size": (ap.clothing_size if ap else None) or (str(p.clothing_size) if p.clothing_size else None),
                    "shoe_size": (ap.shoe_size if ap else None) or (str(p.shoe_size) if p.shoe_size else None),
                    "look_type": ap.look_type if ap else None,
                    "hair_color": ap.hair_color if ap else None,
                    "hair_length": ap.hair_length if ap else None,
                    "bust_volume": ap.bust_volume if ap else None,
                    "waist_volume": ap.waist_volume if ap else None,
                    "hip_volume": ap.hip_volume if ap else None,
                    "experience": ap.experience if ap else None,
                    "qualification": ap.qualification if ap else None,
                    "about_me": (ap.about_me if ap else None) or (p.about_me if hasattr(p, 'about_me') else None),
                    "video_intro": ap.video_intro if ap else None,
                    "phone_number": ap.phone_number if ap else p.phone_number,
                    "email": ap.email if ap else p.email,
                    "has_agent": has_agent,
                    "agent_name": agent_name,
                    "photo_url": ap_photo or ap_photo_fallback or legacy_photo,
                    "media_assets": media,
                }


class ActorReviewRouter:
    """Оценки и отзывы об актёрах (Yandex-Taxi style)."""

    def __init__(self):
        self.router = APIRouter(tags=["actor-reviews"], prefix="/actors")
        self._include()

    def _include(self):

        async def _ensure_reviews_table():
            from postgres.database import async_engine
            from sqlalchemy import text
            async with async_engine.begin() as conn:
                await conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS actor_reviews (
                        id SERIAL PRIMARY KEY,
                        profile_id INTEGER NOT NULL,
                        reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                        comment TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                        UNIQUE (profile_id, reviewer_id)
                    )
                """))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_actor_reviews_profile ON actor_reviews (profile_id, created_at)"
                ))
                await conn.execute(text(
                    "CREATE INDEX IF NOT EXISTS ix_actor_reviews_reviewer ON actor_reviews (reviewer_id)"
                ))
                await conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_actor_reviews_profile_reviewer "
                    "ON actor_reviews (profile_id, reviewer_id)"
                ))

        @self.router.get("/{profile_id}/reviews/")
        async def get_reviews(
            profile_id: int,
            authorized: JWT = Depends(tma_authorized),
        ):
            from postgres.database import async_session_maker
            from crm.models import ActorReview
            from users.models import User
            from sqlalchemy import select, func

            try:
                await _ensure_reviews_table()
            except Exception:
                pass

            ROLE_LABELS = {
                'owner': 'SuperAdmin', 'employer_pro': 'Админ PRO',
                'employer': 'Админ', 'administrator': 'Админ', 'manager': 'Админ',
            }

            async with async_session_maker() as session:
                avg = (await session.execute(
                    select(func.avg(ActorReview.rating)).where(ActorReview.profile_id == profile_id)
                )).scalar()
                count = (await session.execute(
                    select(func.count()).where(ActorReview.profile_id == profile_id)
                )).scalar() or 0

                rows = (await session.execute(
                    select(ActorReview)
                    .where(ActorReview.profile_id == profile_id)
                    .order_by(ActorReview.created_at.desc())
                    .limit(50)
                )).scalars().all()

                reviews = []
                for r in rows:
                    user = await session.get(User, r.reviewer_id)
                    role_val = (user.role.value if hasattr(user.role, 'value') else str(user.role)) if user else ''
                    reviewer_name = f"{user.first_name or ''} {user.last_name or ''}".strip() if user else f"User #{r.reviewer_id}"
                    if not reviewer_name or reviewer_name == '':
                        reviewer_name = (user.email or '').split('@')[0] if user else f"User #{r.reviewer_id}"
                    reviews.append({
                        "id": r.id,
                        "reviewer_id": r.reviewer_id,
                        "reviewer_name": reviewer_name,
                        "reviewer_role": role_val,
                        "reviewer_role_label": ROLE_LABELS.get(role_val, 'Пользователь'),
                        "rating": r.rating,
                        "comment": r.comment,
                        "created_at": str(r.created_at),
                        "is_mine": r.reviewer_id == int(authorized.id),
                    })

                return {
                    "avg_rating": round(float(avg), 1) if avg else 5.0,
                    "review_count": count,
                    "reviews": reviews,
                }

        @self.router.post("/{profile_id}/reviews/")
        async def submit_review(
            profile_id: int,
            request: Request,
            authorized: JWT = Depends(employer_authorized),
        ):
            from postgres.database import async_session_maker
            from crm.models import ActorReview
            from sqlalchemy import select

            try:
                await _ensure_reviews_table()
            except Exception:
                pass

            body = await request.json()
            rating = int(body.get("rating", 0))
            comment = str(body.get("comment", "")).strip()
            if rating < 1 or rating > 5:
                raise HTTPException(status_code=422, detail="Rating must be 1-5")

            async with async_session_maker() as session:
                existing = (await session.execute(
                    select(ActorReview).where(
                        ActorReview.profile_id == profile_id,
                        ActorReview.reviewer_id == int(authorized.id),
                    )
                )).scalar_one_or_none()

                if existing:
                    existing.rating = rating
                    existing.comment = comment or None
                    session.add(existing)
                    await session.commit()
                    return {"ok": True, "id": existing.id, "updated": True, "rating": rating}

                review = ActorReview(
                    profile_id=profile_id,
                    reviewer_id=int(authorized.id),
                    rating=rating,
                    comment=comment or None,
                )
                session.add(review)
                await session.commit()
                return {"ok": True, "id": review.id, "created": True, "rating": rating}

        @self.router.delete("/{profile_id}/reviews/{review_id}/")
        async def delete_review(
            profile_id: int,
            review_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            from postgres.database import async_session_maker
            from crm.models import ActorReview

            async with async_session_maker() as session:
                review = await session.get(ActorReview, review_id)
                if not review:
                    raise HTTPException(status_code=404, detail="Отзыв не найден")
                if review.reviewer_id != int(authorized.id) and authorized.role not in ['owner', Roles.owner.value]:
                    raise HTTPException(status_code=403, detail="Можно удалить только свой отзыв")
                await session.delete(review)
                await session.commit()
                return {"deleted": True}


class EmployerFavoritesRouter:
    """Избранные актёры для всех админ-ролей."""

    def __init__(self):
        self.router = APIRouter(tags=["favorites"], prefix="/favorites")
        self._include()

    def _include(self):
        async def _ensure_table():
            """Create employer_favorites table if missing (safe for first deploy)."""
            from postgres.database import async_engine
            from sqlalchemy import text
            async with async_engine.begin() as conn:
                exists = await conn.scalar(
                    text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'employer_favorites')")
                )
                if not exists:
                    await conn.execute(text("""
                        CREATE TABLE employer_favorites (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                            profile_id INTEGER NOT NULL,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            CONSTRAINT uq_employer_favorite UNIQUE (user_id, profile_id)
                        )
                    """))
                    await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employer_favorites_user_id ON employer_favorites(user_id)"))
                    await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_employer_favorites_profile_id ON employer_favorites(profile_id)"))
                else:
                    fk_exists = await conn.scalar(text("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.table_constraints
                            WHERE table_name = 'employer_favorites'
                            AND constraint_type = 'FOREIGN KEY'
                            AND constraint_name LIKE '%profile_id%'
                        )
                    """))
                    if fk_exists:
                        try:
                            await conn.execute(text("""
                                ALTER TABLE employer_favorites DROP CONSTRAINT IF EXISTS employer_favorites_profile_id_fkey
                            """))
                        except Exception:
                            pass

        @self.router.get("/")
        async def list_favorites(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Список избранных актёров текущего пользователя."""
            from postgres.database import async_session_maker as async_session
            from users.models import EmployerFavorite
            from users.models import ActorProfile
            try:
                await _ensure_table()
            except Exception:
                pass
            async with async_session() as session:
                user_id = int(authorized.id)
                try:
                    result = await session.execute(
                        select(EmployerFavorite).where(EmployerFavorite.user_id == user_id)
                            .order_by(EmployerFavorite.created_at.desc())
                    )
                    favs = result.scalars().all()
                except Exception:
                    return {"favorites": [], "profile_ids": []}
                profile_ids = [f.profile_id for f in favs]

                if not profile_ids:
                    return {"favorites": [], "profile_ids": []}

                profiles_result = await session.execute(
                    select(Profile).where(Profile.id.in_(profile_ids))
                )
                profiles = {p.id: p for p in profiles_result.unique().scalars().all()}

                items = []
                for pid in profile_ids:
                    p = profiles.get(pid)
                    if not p:
                        continue
                    photo = None
                    if hasattr(p, 'images') and p.images:
                        photo = p.images[0].crop_photo_url or p.images[0].photo_url

                    ap_result = await session.execute(
                        select(ActorProfile).where(
                            ActorProfile.user_id == p.user_id,
                            ActorProfile.is_deleted == False,
                        ).order_by(ActorProfile.created_at.desc()).limit(1)
                    )
                    ap = ap_result.unique().scalar_one_or_none()

                    media_assets = []
                    ap_photo = None
                    if ap and ap.media_assets:
                        for m in ap.media_assets:
                            media_assets.append({
                                "id": m.id, "file_type": m.file_type,
                                "original_url": m.original_url, "processed_url": m.processed_url,
                                "thumbnail_url": m.thumbnail_url, "is_primary": m.is_primary,
                            })
                            if m.file_type == "photo" and m.is_primary:
                                ap_photo = m.processed_url or m.original_url

                    age = None
                    if p.date_of_birth:
                        from datetime import datetime
                        today = datetime.now().date()
                        age = today.year - p.date_of_birth.year

                    items.append({
                        "profile_id": p.id,
                        "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                        "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                        "display_name": ap.display_name if ap else None,
                        "gender": p.gender.value if hasattr(p.gender, 'value') else str(p.gender) if p.gender else None,
                        "city": (ap.city if ap and ap.city else None) or (str(p.city_full) if p.city_full else None),
                        "age": age,
                        "photo_url": ap_photo or photo,
                        "media_assets": media_assets,
                    })

                return {"favorites": items, "profile_ids": profile_ids}

        @self.router.post("/toggle/")
        async def toggle_favorite(
            profile_id: int = Query(...),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Добавить/убрать актёра из избранного."""
            from postgres.database import async_session_maker as async_session
            from sqlalchemy import text
            try:
                await _ensure_table()
            except Exception:
                pass
            try:
                async with async_session() as session:
                    user_id = int(authorized.id)
                    existing = await session.execute(
                        text("SELECT id FROM employer_favorites WHERE user_id = :uid AND profile_id = :pid"),
                        {"uid": user_id, "pid": profile_id},
                    )
                    row = existing.first()
                    if row:
                        await session.execute(
                            text("DELETE FROM employer_favorites WHERE id = :id"),
                            {"id": row[0]},
                        )
                        await session.execute(
                            text(
                                "UPDATE profile_responses SET status = 'pending' "
                                "WHERE profile_id = :pid AND status = 'shortlisted'"
                            ),
                            {"pid": profile_id},
                        )
                        await session.commit()
                        return {"ok": True, "action": "removed", "profile_id": profile_id}
                    else:
                        await session.execute(
                            text("INSERT INTO employer_favorites (user_id, profile_id, created_at) VALUES (:uid, :pid, NOW())"),
                            {"uid": user_id, "pid": profile_id},
                        )
                        await session.execute(
                            text(
                                "UPDATE profile_responses SET status = 'shortlisted' "
                                "WHERE profile_id = :pid AND status IN ('pending', 'viewed')"
                            ),
                            {"pid": profile_id},
                        )
                        await session.commit()

                        try:
                            from profiles.models import Profile
                            actor_profile = await session.get(Profile, profile_id)
                            if actor_profile and actor_profile.user_id:
                                await NotificationService.create(
                                    user_id=actor_profile.user_id,
                                    type=NotificationType.SYSTEM,
                                    title="Вы в избранном ⭐",
                                    message="Ваш профиль добавили в избранное!",
                                )
                        except Exception:
                            pass

                        return {"ok": True, "action": "added", "profile_id": profile_id}
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"toggle error: {e.__class__.__name__}: {e}")

        @self.router.get("/ids/")
        async def get_favorite_ids(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Быстрый список ID избранных профилей (для отметок в UI)."""
            from postgres.database import async_session_maker as async_session
            from users.models import EmployerFavorite
            try:
                await _ensure_table()
            except Exception:
                pass
            from sqlalchemy import text as _text
            async with async_session() as session:
                user_id = int(authorized.id)
                try:
                    result = await session.execute(
                        _text("SELECT profile_id FROM employer_favorites WHERE user_id = :uid"),
                        {"uid": user_id},
                    )
                    ids = [row[0] for row in result.all()]
                    if ids:
                        await session.execute(
                            _text(
                                "UPDATE profile_responses SET status = 'shortlisted' "
                                "WHERE profile_id = ANY(:pids) AND status IN ('pending', 'viewed')"
                            ),
                            {"pids": ids},
                        )
                        await session.commit()
                except Exception:
                    ids = []
                return {"profile_ids": ids}


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
            """Список отчётов (шорт-листов) работодателя с агрегированной
            статистикой и названием кастинга/проекта."""
            from postgres.database import async_session_maker
            from reports.models import Report, ProfilesReports
            from castings.models import Casting, CastingImage
            from profiles.models import Response
            from sqlalchemy import select, func, case, literal, and_, exists
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

                # Предзагружаем кастинги и их родителей одним махом
                casting_ids = list({r.casting_id for r in reports})
                casting_map: dict[int, Casting] = {}
                if casting_ids:
                    cres = await session.execute(select(Casting).where(Casting.id.in_(casting_ids)))
                    for c in cres.scalars().unique().all():
                        casting_map[c.id] = c

                parent_ids = [
                    c.parent_project_id for c in casting_map.values()
                    if c.parent_project_id is not None
                ]
                parent_map: dict[int, Casting] = {}
                if parent_ids:
                    pres = await session.execute(select(Casting).where(Casting.id.in_(parent_ids)))
                    for c in pres.scalars().unique().all():
                        parent_map[c.id] = c

                # Счётчики: всего актёров в отчёте и из них откликавшихся на кастинг
                report_ids = [r.id for r in reports]
                counts: dict[int, dict] = {rid: {"total": 0, "via": 0} for rid in report_ids}
                if report_ids:
                    # total: сколько актёров в каждом отчёте
                    t_res = await session.execute(
                        select(ProfilesReports.report_id, func.count(ProfilesReports.profile_id))
                        .where(ProfilesReports.report_id.in_(report_ids))
                        .group_by(ProfilesReports.report_id)
                    )
                    for rid, cnt in t_res.all():
                        counts[rid]["total"] = int(cnt or 0)

                    # via: сколько из них реально откликались на кастинг отчёта
                    v_res = await session.execute(
                        select(
                            ProfilesReports.report_id,
                            func.count(func.distinct(ProfilesReports.profile_id)),
                        )
                        .join(Report, Report.id == ProfilesReports.report_id)
                        .join(
                            Response,
                            and_(
                                Response.profile_id == ProfilesReports.profile_id,
                                Response.casting_id == Report.casting_id,
                            ),
                        )
                        .where(ProfilesReports.report_id.in_(report_ids))
                        .group_by(ProfilesReports.report_id)
                    )
                    for rid, cnt in v_res.all():
                        counts[rid]["via"] = int(cnt or 0)

                items = []
                for r in reports:
                    c = casting_map.get(r.casting_id)
                    casting_title = c.title if c else None
                    project_title = None
                    if c and c.parent_project_id:
                        parent = parent_map.get(c.parent_project_id)
                        project_title = parent.title if parent else None
                    else:
                        # сам кастинг выступает как проект
                        project_title = casting_title

                    image_url = None
                    if c and getattr(c, 'image', None):
                        first = c.image[0] if isinstance(c.image, list) and c.image else c.image
                        if first:
                            image_url = getattr(first, 'photo_url', None)

                    total_actors = counts.get(r.id, {}).get("total", 0)
                    via = counts.get(r.id, {}).get("via", 0)
                    without = max(0, total_actors - via)

                    items.append({
                        "id": r.id,
                        "title": r.title,
                        "casting_id": r.casting_id,
                        "casting_title": casting_title,
                        "project_title": project_title,
                        "casting_image_url": image_url,
                        "public_id": r.public_id,
                        "created_at": str(r.created_at),
                        "actors_total": total_actors,
                        "actors_via_casting": via,
                        "actors_without_casting": without,
                    })

                return {"reports": items, "total": total}

        @self.router.post("/create/")
        async def create_report(
            casting_id: int = Query(...),
            title: str = Query(...),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Создать отчёт (шорт-лист) для кастинга."""
            from postgres.database import async_session_maker
            from reports.models import Report
            from castings.models import Casting, ProjectCollaborator
            from users.models import User
            from sqlalchemy import select
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Casting not found")

                role = authorized.role
                if role not in ['owner', 'administrator', 'manager']:
                    if getattr(casting, 'owner_id', None) != int(authorized.id):
                        project_id = getattr(casting, 'parent_project_id', None) or casting.id
                        collab = await session.execute(
                            select(ProjectCollaborator).where(
                                ProjectCollaborator.casting_id == project_id,
                                ProjectCollaborator.user_id == int(authorized.id),
                            )
                        )
                        if not collab.scalar_one_or_none():
                            raise HTTPException(status_code=403, detail="Not your casting")

                report = Report(casting_id=casting_id, title=title)
                session.add(report)
                await session.flush()
                await session.commit()

                try:
                    actor = await session.get(User, int(authorized.id))
                    actor_name = EmployerService._display_user_name(actor, f"User #{authorized.id}")
                    await NotificationService.notify_project_team(
                        casting_id=casting.id,
                        type=NotificationType.SYSTEM,
                        title="Отчёт сформирован",
                        message=f"📋 {actor_name} сформировал отчёт «{report.title}» по кастингу «{casting.title}».",
                        exclude_user_id=int(authorized.id),
                    )
                except Exception:
                    pass

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

                    try:
                        from profiles.models import Profile
                        actor_profile = await session.get(Profile, pid)
                        if actor_profile and actor_profile.user_id:
                            await NotificationService.create(
                                user_id=actor_profile.user_id,
                                type=NotificationType.SYSTEM,
                                title="Вы на рассмотрении",
                                message=f"📋 Вас добавили в отчёт «{report.title}» для проекта «{casting.title if casting else '—'}».",
                            )
                    except Exception:
                        pass

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

                from users.models import ActorProfile
                from datetime import datetime

                actors = []
                for link in links:
                    p = link.profile
                    if not p:
                        continue

                    photo = None
                    if hasattr(p, 'images') and p.images:
                        photo = p.images[0].crop_photo_url or p.images[0].photo_url

                    age = None
                    if p.date_of_birth:
                        today = datetime.now().date()
                        dob = p.date_of_birth
                        if hasattr(dob, 'date'):
                            dob = dob.date()
                        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

                    ap_result = await session.execute(
                        select(ActorProfile).where(
                            ActorProfile.user_id == p.user_id,
                            ActorProfile.is_deleted == False,
                        ).order_by(ActorProfile.created_at.desc()).limit(1)
                    )
                    ap = ap_result.unique().scalar_one_or_none()

                    ap_photo = None
                    ap_photo_fallback = None
                    media_assets = []
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
                            if m.file_type == "photo":
                                if m.is_primary:
                                    ap_photo = m.processed_url or m.original_url
                                elif ap_photo_fallback is None:
                                    ap_photo_fallback = m.processed_url or m.original_url

                    actors.append({
                        "profile_id": p.id,
                        "actor_profile_id": ap.id if ap else None,
                        "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                        "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                        "display_name": ap.display_name if ap else None,
                        "gender": p.gender.value if hasattr(p.gender, 'value') else str(p.gender) if p.gender else (ap.gender if ap else None),
                        "age": age,
                        "city": (ap.city if ap and ap.city else None) or (str(p.city_full) if p.city_full else None),
                        "height": ap.height if ap else (float(p.height) if p.height else None),
                        "clothing_size": (ap.clothing_size if ap else None) or (str(p.clothing_size) if p.clothing_size else None),
                        "shoe_size": (ap.shoe_size if ap else None) or (str(p.shoe_size) if p.shoe_size else None),
                        "look_type": ap.look_type if ap else None,
                        "hair_color": ap.hair_color if ap else None,
                        "photo_url": ap_photo or ap_photo_fallback or photo,
                        "media_assets": media_assets,
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

        @self.router.post("/respond/")
        async def respond_to_casting(
            data: SActorResponseCreate,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Откликнуться на проект."""
            try:
                return await ActorFeedService.respond_to_casting(
                    user_token=authorized,
                    casting_id=data.casting_id,
                    self_test_url=data.self_test_url,
                )
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                raise HTTPException(status_code=500, detail=f"{e.__class__.__name__}: {e}\n{tb[-500:]}")

        @self.router.post("/agent-respond/")
        async def agent_respond_to_casting(
            data: SAgentBulkResponseCreate,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Агент откликает нескольких своих актёров на кастинг."""
            return await ActorFeedService.agent_respond_to_casting(
                user_token=authorized,
                casting_id=data.casting_id,
                profile_ids=data.profile_ids,
            )

        @self.router.get("/my-responses/", response_model=SActorResponseHistory)
        async def get_my_responses(
            authorized: JWT = Depends(tma_authorized),
        ):
            """История моих откликов."""
            return await ActorFeedService.get_my_responses(user_token=authorized)

        @self.router.get("/my-review-status/")
        async def get_my_review_status(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Статус рассмотрения актёра: на рассмотрении / в избранном / отклонено."""
            from postgres.database import async_session_maker
            from reports.models import ProfilesReports
            from castings.models import Casting
            from castings.enums import CastingStatusEnum
            from sqlalchemy import select, text
            from sqlalchemy.orm import joinedload

            async with async_session_maker() as session:
                profile = await ActorFeedService._get_or_create_response_profile(session, authorized)
                if not profile:
                    return {"in_review": False, "items": []}

                pr_result = await session.execute(
                    select(ProfilesReports)
                    .options(joinedload(ProfilesReports.report))
                    .where(ProfilesReports.profile_id == profile.id)
                )
                entries = pr_result.unique().scalars().all()

                fav_ids: set[int] = set()
                try:
                    fav_result = await session.execute(
                        text("SELECT user_id FROM employer_favorites WHERE profile_id = :pid"),
                        {"pid": profile.id},
                    )
                    if fav_result.all():
                        fav_ids.add(profile.id)
                except Exception:
                    pass

                is_favorited_in_report = any(getattr(pr, 'favorite', False) for pr in entries)

                items = []
                for pr in entries:
                    report = pr.report
                    casting = await session.get(Casting, report.casting_id) if report else None

                    if casting and casting.status == CastingStatusEnum.closed:
                        actor_status = 'rejected'
                        actor_status_label = 'Отклонено'
                    elif profile.id in fav_ids or getattr(pr, 'favorite', False):
                        actor_status = 'favorited'
                        actor_status_label = 'В избранном'
                    else:
                        actor_status = 'in_review'
                        actor_status_label = 'На рассмотрении'

                    items.append({
                        "report_id": report.id if report else None,
                        "report_title": report.title if report else None,
                        "casting_title": casting.title if casting else None,
                        "casting_status": casting.status.value if casting else None,
                        "actor_status": actor_status,
                        "actor_status_label": actor_status_label,
                        "added_at": str(pr.created_at) if pr.created_at else None,
                    })

                has_any = len(items) > 0
                return {"in_review": has_any, "items": items}

        @self.router.get("/admin-profile/{user_id}/")
        async def get_admin_public_profile(
            user_id: int,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Публичный профиль админа/работодателя для актёров."""
            from postgres.database import async_session_maker
            from users.models import User
            from castings.models import Casting
            from castings.enums import CastingStatusEnum
            from sqlalchemy import select, func

            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="Пользователь не найден")

                parts = [p for p in [user.first_name, user.last_name] if p]
                display_name = " ".join(parts) if parts else (user.email or f"user#{user.id}")

                role_labels = {
                    'employer': 'Админ',
                    'employer_pro': 'Админ PRO',
                    'owner': 'Суперадмин',
                    'administrator': 'Администратор',
                    'manager': 'Менеджер',
                }
                role_val = user.role.value if hasattr(user.role, 'value') else str(user.role)
                role_label = role_labels.get(role_val, role_val)

                published_count_result = await session.execute(
                    select(func.count(Casting.id)).where(
                        Casting.published_by_id == user_id,
                        Casting.status == CastingStatusEnum.published,
                    )
                )
                published_count = published_count_result.scalar() or 0

                total_count_result = await session.execute(
                    select(func.count(Casting.id)).where(Casting.published_by_id == user_id)
                )
                total_count = total_count_result.scalar() or 0

                castings_result = await session.execute(
                    select(Casting)
                    .where(Casting.published_by_id == user_id, Casting.status == CastingStatusEnum.published)
                    .order_by(Casting.created_at.desc())
                    .limit(10)
                )
                recent_castings = castings_result.scalars().all()
                casting_items = []
                for c in recent_castings:
                    casting_items.append({
                        "id": c.id,
                        "title": c.title,
                        "description": (c.description or "")[:150],
                        "image_url": await EmployerService._get_casting_image_url(session, c.id, casting=c),
                        "created_at": str(c.created_at) if c.created_at else None,
                    })

                member_since = user.created_at.strftime('%d.%m.%Y') if user.created_at else None

                return {
                    "id": user.id,
                    "display_name": display_name,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "photo_url": user.photo_url,
                    "role": role_val,
                    "role_label": role_label,
                    "member_since": member_since,
                    "published_castings_count": published_count,
                    "total_castings_count": total_count,
                    "recent_castings": casting_items,
                }


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

        @self.router.get("/actor-profiles/{profile_id}/")
        async def get_actor_profile(
            profile_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: получить полный профиль актёра."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")
            from postgres.database import async_session_maker
            from users.models import ActorProfile
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload
            async with async_session_maker() as session:
                result = await session.execute(
                    select(ActorProfile)
                    .options(selectinload(ActorProfile.media_assets))
                    .where(ActorProfile.id == profile_id)
                )
                profile = result.unique().scalar_one_or_none()
                if not profile:
                    raise HTTPException(status_code=404, detail="Actor profile not found")
                media = []
                for m in (profile.media_assets or []):
                    media.append({
                        "id": m.id, "file_type": m.file_type,
                        "original_url": m.original_url, "processed_url": m.processed_url,
                        "is_primary": m.is_primary,
                    })
                return {
                    "id": profile.id, "user_id": profile.user_id,
                    "display_name": profile.display_name, "first_name": profile.first_name,
                    "last_name": profile.last_name, "gender": profile.gender,
                    "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
                    "phone_number": profile.phone_number, "email": profile.email,
                    "city": profile.city, "qualification": profile.qualification,
                    "experience": profile.experience, "about_me": profile.about_me,
                    "look_type": profile.look_type, "hair_color": profile.hair_color,
                    "hair_length": profile.hair_length, "height": profile.height,
                    "clothing_size": profile.clothing_size, "shoe_size": profile.shoe_size,
                    "bust_volume": profile.bust_volume, "waist_volume": profile.waist_volume,
                    "hip_volume": profile.hip_volume, "video_intro": profile.video_intro,
                    "internal_notes": profile.internal_notes, "admin_rating": profile.admin_rating,
                    "trust_score": profile.trust_score,
                    "is_active": profile.is_active, "is_deleted": profile.is_deleted,
                    "created_at": str(profile.created_at), "updated_at": str(profile.updated_at),
                    "media_assets": media,
                }

        @self.router.patch("/actor-profiles/{profile_id}/")
        async def update_actor_profile(
            profile_id: int,
            body: dict = Body(...),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: редактировать профиль актёра."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")
            from postgres.database import async_session_maker
            from users.models import ActorProfile
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            async with async_session_maker() as session:
                result = await session.execute(
                    select(ActorProfile)
                    .options(selectinload(ActorProfile.media_assets))
                    .where(ActorProfile.id == profile_id)
                )
                profile = result.unique().scalar_one_or_none()
                if not profile:
                    raise HTTPException(status_code=404, detail="Actor profile not found")

                if not body:
                    raise HTTPException(status_code=400, detail="No data provided")

                EDITABLE = {
                    'display_name', 'first_name', 'last_name', 'gender', 'date_of_birth',
                    'phone_number', 'email', 'city', 'qualification', 'experience', 'about_me',
                    'look_type', 'hair_color', 'hair_length', 'height', 'clothing_size', 'shoe_size',
                    'bust_volume', 'waist_volume', 'hip_volume', 'video_intro',
                    'internal_notes', 'admin_rating', 'trust_score', 'is_active',
                }
                for key, value in body.items():
                    if key in EDITABLE:
                        setattr(profile, key, value)

                session.add(profile)
                await session.commit()
                await session.refresh(profile)

                media = []
                for m in (profile.media_assets or []):
                    media.append({
                        "id": m.id, "file_type": m.file_type,
                        "original_url": m.original_url, "processed_url": m.processed_url,
                        "is_primary": m.is_primary,
                    })
                return {
                    "id": profile.id, "user_id": profile.user_id,
                    "display_name": profile.display_name, "first_name": profile.first_name,
                    "last_name": profile.last_name, "gender": profile.gender,
                    "date_of_birth": str(profile.date_of_birth) if profile.date_of_birth else None,
                    "phone_number": profile.phone_number, "email": profile.email,
                    "city": profile.city, "qualification": profile.qualification,
                    "experience": profile.experience, "about_me": profile.about_me,
                    "look_type": profile.look_type, "hair_color": profile.hair_color,
                    "hair_length": profile.hair_length, "height": profile.height,
                    "clothing_size": profile.clothing_size, "shoe_size": profile.shoe_size,
                    "bust_volume": profile.bust_volume, "waist_volume": profile.waist_volume,
                    "hip_volume": profile.hip_volume, "video_intro": profile.video_intro,
                    "internal_notes": profile.internal_notes, "admin_rating": profile.admin_rating,
                    "trust_score": profile.trust_score,
                    "is_active": profile.is_active, "is_deleted": profile.is_deleted,
                    "created_at": str(profile.created_at), "updated_at": str(profile.updated_at),
                    "media_assets": media,
                }

        # ── Projects management ──

        @self.router.get("/projects/")
        async def list_all_projects(
            page: int = Query(1, gt=0),
            page_size: int = Query(50, gt=0),
            search: str = Query("", description="Поиск по названию"),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: список ВСЕХ проектов с полной информацией."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from profiles.models import Response
            from reports.models import Report
            from sqlalchemy import select, func, or_
            from sqlalchemy.orm import selectinload

            async with async_session_maker() as session:
                base = select(Casting).where(Casting.parent_project_id == None)
                if search.strip():
                    base = base.where(Casting.title.ilike(f"%{search.strip()}%"))

                total = (await session.execute(
                    select(func.count()).select_from(base.subquery())
                )).scalar() or 0

                query = base.order_by(Casting.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
                castings = (await session.execute(query)).scalars().unique().all()

                projects = []
                for c in castings:
                    sub_ids_result = await session.execute(
                        select(Casting.id).where(Casting.parent_project_id == c.id)
                    )
                    sub_ids = [row[0] for row in sub_ids_result.all()]
                    all_ids = [c.id] + sub_ids

                    resp_count = (await session.execute(
                        select(func.count()).where(Response.casting_id.in_(all_ids))
                    )).scalar() or 0
                    collab_count = (await session.execute(
                        select(func.count()).select_from(ProjectCollaborator).where(
                            ProjectCollaborator.casting_id == c.id
                        )
                    )).scalar() or 0
                    report_count = (await session.execute(
                        select(func.count()).select_from(Report).where(Report.casting_id.in_(all_ids))
                    )).scalar() or 0

                    image_url = await EmployerService._get_casting_image_url(session, c.id)

                    owner_name = None
                    if c.owner_id:
                        owner = await session.get(User, c.owner_id)
                        if owner:
                            parts = [p for p in [owner.first_name, owner.last_name] if p]
                            owner_name = " ".join(parts) if parts else (owner.email or f"user#{owner.id}")

                    publisher_name = None
                    if getattr(c, 'published_by_id', None) and getattr(c, 'published_by', None):
                        u = c.published_by
                        parts = [p for p in [u.first_name, u.last_name] if p]
                        publisher_name = " ".join(parts) if parts else (u.email or f"user#{u.id}")

                    published_at = None
                    if c.post and c.post.published_at:
                        published_at = c.post.published_at

                    projects.append({
                        "id": c.id,
                        "title": c.title,
                        "description": c.description,
                        "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                        "owner_id": getattr(c, 'owner_id', None) or 0,
                        "owner_name": owner_name,
                        "published_by": publisher_name,
                        "response_count": resp_count,
                        "sub_castings_count": len(sub_ids),
                        "collaborator_count": collab_count,
                        "team_size": collab_count + 1,
                        "report_count": report_count,
                        "image_url": image_url,
                        "published_at": published_at,
                        "created_at": c.created_at,
                        "updated_at": c.updated_at,
                    })

                return {"projects": projects, "total": total}

        @self.router.get("/projects/{project_id}/")
        async def get_project_full(
            project_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: полная информация о проекте включая кастинги и команду."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from profiles.models import Response
            from reports.models import Report
            from sqlalchemy import select, func
            from sqlalchemy.orm import selectinload

            async with async_session_maker() as session:
                casting = await session.get(Casting, project_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")

                sub_result = await session.execute(
                    select(Casting).where(Casting.parent_project_id == project_id)
                )
                sub_castings = sub_result.scalars().all()

                all_ids = [casting.id] + [sc.id for sc in sub_castings]
                resp_count = (await session.execute(
                    select(func.count()).where(Response.casting_id.in_(all_ids))
                )).scalar() or 0
                report_count = (await session.execute(
                    select(func.count()).select_from(Report).where(Report.casting_id.in_(all_ids))
                )).scalar() or 0

                collabs_result = await session.execute(
                    select(ProjectCollaborator).where(ProjectCollaborator.casting_id == project_id)
                )
                collabs = collabs_result.scalars().all()
                team = []
                for col in collabs:
                    u = await session.get(User, col.user_id)
                    team.append({
                        "collab_id": col.id,
                        "user_id": col.user_id,
                        "role": col.role,
                        "first_name": u.first_name if u else None,
                        "last_name": u.last_name if u else None,
                        "email": u.email if u else None,
                        "created_at": str(col.created_at),
                    })

                owner_name = None
                if casting.owner_id:
                    owner = await session.get(User, casting.owner_id)
                    if owner:
                        parts = [p for p in [owner.first_name, owner.last_name] if p]
                        owner_name = " ".join(parts) if parts else (owner.email or f"user#{owner.id}")

                image_url = await EmployerService._get_casting_image_url(session, project_id)

                sub_list = []
                for sc in sub_castings:
                    sc_resp = (await session.execute(
                        select(func.count()).where(Response.casting_id == sc.id)
                    )).scalar() or 0
                    sc_image = await EmployerService._get_casting_image_url(session, sc.id, casting=sc)
                    sub_list.append({
                        "id": sc.id,
                        "title": sc.title,
                        "description": sc.description,
                        "status": sc.status.value if hasattr(sc.status, 'value') else str(sc.status),
                        "response_count": sc_resp,
                        "image_url": sc_image,
                        "created_at": sc.created_at,
                    })

                published_at = None
                if casting.post and casting.post.published_at:
                    published_at = casting.post.published_at

                return {
                    "id": casting.id,
                    "title": casting.title,
                    "description": casting.description,
                    "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                    "owner_id": getattr(casting, 'owner_id', None) or 0,
                    "owner_name": owner_name,
                    "response_count": resp_count,
                    "report_count": report_count,
                    "image_url": image_url,
                    "published_at": published_at,
                    "created_at": casting.created_at,
                    "updated_at": casting.updated_at,
                    "team": team,
                    "sub_castings": sub_list,
                }

        @self.router.patch("/projects/{project_id}/")
        async def update_any_project(
            project_id: int,
            body: dict = Body(...),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: редактировать любой проект."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from castings.models import Casting

            EDITABLE = {'title', 'description', 'status'}

            async with async_session_maker() as session:
                casting = await session.get(Casting, project_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")

                for key, value in body.items():
                    if key in EDITABLE:
                        if key == 'status':
                            from castings.enums import CastingStatusEnum
                            try:
                                casting.status = CastingStatusEnum(value)
                            except ValueError:
                                raise HTTPException(status_code=400, detail=f"Invalid status: {value}")
                        else:
                            setattr(casting, key, value)

                session.add(casting)
                await session.commit()
                await session.refresh(casting)

                image_url = await EmployerService._get_casting_image_url(session, project_id)
                return {
                    "id": casting.id,
                    "title": casting.title,
                    "description": casting.description,
                    "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                    "owner_id": getattr(casting, 'owner_id', 0),
                    "image_url": image_url,
                    "created_at": casting.created_at,
                    "updated_at": casting.updated_at,
                }

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
            from users.models import User, ActorProfile
            from sqlalchemy.orm import selectinload
            from sqlalchemy import select, func
            async with async_session_maker() as session:
                total = (await session.execute(select(func.count(User.id)))).scalar() or 0
                query = select(User).order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
                users = (await session.execute(query)).scalars().all()
                users_payload = []
                for u in users:
                    role_val = u.role.value if hasattr(u.role, 'value') else str(u.role)
                    photo_url = getattr(u, 'photo_url', None)
                    if role_val in ['user', 'agent']:
                        ap_result = await session.execute(
                            select(ActorProfile)
                            .options(selectinload(ActorProfile.media_assets))
                            .where(
                                ActorProfile.user_id == u.id,
                                ActorProfile.is_deleted == False,
                            )
                            .order_by(ActorProfile.created_at.desc())
                        )
                        actor_profiles = ap_result.scalars().all()
                        for p in actor_profiles:
                            primary_photo = next((
                                m.thumbnail_url or m.processed_url or m.original_url
                                for m in (p.media_assets or [])
                                if m.file_type == 'photo' and getattr(m, 'is_primary', False)
                            ), None)
                            fallback_photo = next((
                                m.thumbnail_url or m.processed_url or m.original_url
                                for m in (p.media_assets or [])
                                if m.file_type == 'photo'
                            ), None)
                            if primary_photo or fallback_photo:
                                photo_url = primary_photo or fallback_photo
                                break

                    users_payload.append({
                        "id": u.id,
                        "role": role_val,
                        "first_name": u.first_name,
                        "last_name": u.last_name,
                        "middle_name": getattr(u, 'middle_name', None),
                        "email": u.email,
                        "phone_number": getattr(u, 'phone_number', None),
                        "telegram_username": u.telegram_username,
                        "telegram_nick": getattr(u, 'telegram_nick', None),
                        "vk_nick": getattr(u, 'vk_nick', None),
                        "max_nick": getattr(u, 'max_nick', None),
                        "photo_url": photo_url,
                        "is_active": u.is_active,
                        "is_employer_verified": getattr(u, 'is_employer_verified', False),
                        "created_at": str(u.created_at),
                    })
                return {
                    "users": users_payload,
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
                    select(ActorProfile)
                    .options(selectinload(ActorProfile.media_assets))
                    .where(
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
            from sqlalchemy.orm import selectinload
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
                    select(ActorProfile)
                    .options(selectinload(ActorProfile.media_assets))
                    .where(
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
            ticket_type: Optional[str] = Query(None, description="verification | support | all"),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: список всех тикетов верификации / поддержки."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User, VerificationTicket, TicketMessage
            from sqlalchemy import select, func, text
            SUPPORT_MARKER = '__SUPPORT__'
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
                    # Фильтр по типу тикета: support (company_name == __SUPPORT__) или verification (иначе)
                    if ticket_type == 'support':
                        q = q.where(VerificationTicket.company_name == SUPPORT_MARKER)
                    elif ticket_type == 'verification':
                        q = q.where(
                            (VerificationTicket.company_name != SUPPORT_MARKER) |
                            (VerificationTicket.company_name.is_(None))
                        )
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

                        is_support = t.company_name == SUPPORT_MARKER
                        result.append({
                            "id": t.id,
                            "user_id": t.user_id,
                            "status": t.status,
                            "ticket_type": 'support' if is_support else 'verification',
                            "company_name": None if is_support else t.company_name,
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

        @self.router.post("/seed-demo-data/")
        async def seed_demo_data(
            force: bool = Query(False, description="Пересоздать пользователей (обновить пароли)"),
        ):
            """Заполнить БД демо-данными (4 админа + 3 актёра + 2 агента с откликами)."""
            try:
                return await _do_seed(force)
            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                print(f"[SEED ERROR] {e}\n{tb}")
                return {"ok": False, "error": str(e), "traceback": tb[-1000:]}

        async def _do_seed(force: bool):
            from postgres.database import async_session_maker
            from users.models import User, ActorProfile, MediaAsset
            from users.enums import ModelRoles
            from castings.models import Casting
            from profiles.models import Profile, Response
            from castings.enums import CastingStatusEnum
            from datetime import datetime, timezone, timedelta
            from sqlalchemy import select
            from users.services.authentication.types.email_auth import PasswordHasher
            from actor_profiles.media_service import MediaAssetService
            import uuid, io

            def hash_pw(pw: str) -> str:
                return PasswordHasher.hash_password(pw)

            def generate_avatar(name: str, color: tuple, w: int = 600, h: int = 800) -> bytes:
                """Generate a simple JPEG placeholder."""
                from PIL import Image, ImageDraw
                img = Image.new('RGB', (w, h), color)
                draw = ImageDraw.Draw(img)
                initials = "".join(word[0].upper() for word in name.split() if word)[:2]
                font = ImageDraw.ImageDraw.font  # default font
                try:
                    from PIL import ImageFont
                    for path in [
                        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
                    ]:
                        try:
                            font = ImageFont.truetype(path, 120)
                            break
                        except Exception:
                            continue
                    else:
                        font = ImageFont.load_default()
                except Exception:
                    pass
                draw.text((w // 4, h // 3), initials, fill=(255, 255, 255), font=font)
                buf = io.BytesIO()
                img.save(buf, format='JPEG', quality=85)
                return buf.getvalue()

            async def upload_avatar_to_s3(profile_id: int, name: str, colors: list) -> str | None:
                """Upload generated avatars to S3. Returns first URL or None on failure."""
                try:
                    media_svc = MediaAssetService()
                    first_url = None
                    for sort_idx, color in enumerate(colors):
                        img_bytes = generate_avatar(name, color)
                        file_id = uuid.uuid4().hex
                        orig_url = await media_svc._save_file(f"{profile_id}/{file_id}_original.jpg", img_bytes)
                        proc_url = await media_svc._save_file(f"{profile_id}/{file_id}_processed.jpg", img_bytes)
                        thumb_url = await media_svc._save_file(f"{profile_id}/{file_id}_thumb.jpg", img_bytes)
                        if sort_idx == 0:
                            first_url = proc_url
                        async with async_session_maker() as s2:
                            s2.add(MediaAsset(
                                actor_profile_id=profile_id,
                                file_type="photo",
                                original_url=orig_url,
                                processed_url=proc_url,
                                thumbnail_url=thumb_url,
                                is_primary=(sort_idx == 0),
                                sort_order=sort_idx,
                            ))
                            await s2.commit()
                    return first_url
                except Exception as e:
                    print(f"[SEED] Photo upload failed for profile {profile_id}: {e}")
                    return None

            ADMIN_PASSWORD = "Admin1234!"
            ACTOR_PASSWORD = "Actor1234!"
            AGENT_PASSWORD = "Agent1234!"

            AGENTS_DATA = [
                {"email": "agent1@demo.ru", "first_name": "Виктория", "last_name": "Лебедева",
                 "phone_number": "+79161234601", "telegram_nick": "@vika_agent"},
                {"email": "agent2@demo.ru", "first_name": "Игорь", "last_name": "Семёнов",
                 "phone_number": "+79161234602", "telegram_nick": "@igor_talent"},
            ]

            ADMINS_DATA = [
                {"email": "admin1@demo.ru", "first_name": "Александр", "last_name": "Петров", "middle_name": "Игоревич",
                 "phone_number": "+79161234501", "telegram_nick": "@alex_casting"},
                {"email": "admin2@demo.ru", "first_name": "Мария", "last_name": "Соколова", "middle_name": "Викторовна",
                 "phone_number": "+79161234502", "telegram_nick": "@maria_director"},
                {"email": "admin3@demo.ru", "first_name": "Дмитрий", "last_name": "Волков", "middle_name": "Андреевич",
                 "phone_number": "+79161234503", "telegram_nick": "@dmvolk_cast"},
                {"email": "admin4@demo.ru", "first_name": "Анна", "last_name": "Козлова", "middle_name": "Сергеевна",
                 "phone_number": "+79161234504", "telegram_nick": "@anna_prodcast"},
            ]

            PROJECTS_DATA = [
                {"title": "Полнометражный фильм «Рассвет»", "description": "Ищем актёров на главные и второстепенные роли для исторической драмы о событиях 1941 года. Съёмки в Москве и Подмосковье.", "castings": [
                    {"title": "Кастинг на роль Ивана (главная роль)", "description": "Мужчина 25-35 лет, европейская внешность, спортивное телосложение. Опыт работы обязателен."},
                    {"title": "Кастинг на роль Елены (женская роль)", "description": "Женщина 22-30 лет, любой тип внешности. Приветствуется опыт в театре."},
                ]},
                {"title": "Сериал «Большой город»", "description": "Многосерийный проект о жизни молодёжи в мегаполисе. Современная история, живые персонажи.", "castings": [
                    {"title": "Кастинг на роль студента Кирилла", "description": "Молодой человек 18-25 лет, харизматичный, умеет работать в кадре."},
                ]},
                {"title": "Рекламный проект BRAND X", "description": "Съёмки рекламного ролика для крупного бренда. Оплата 50 000 руб./день.", "castings": [
                    {"title": "Типаж: деловая женщина 30-40 лет", "description": "Славянская внешность, уверенная манера держаться, размер одежды 44-46."},
                    {"title": "Типаж: мужчина-профессионал", "description": "Европейская или азиатская внешность, 28-45 лет, деловой стиль."},
                ]},
                {"title": "Театральная постановка «Чайка»", "description": "Новое прочтение Чехова. Ищем молодых актёров с театральным образованием.", "castings": [
                    {"title": "Роль Нины Заречной", "description": "Женщина 20-28 лет, театральное образование обязательно. Эмоциональность, пластика."},
                ]},
            ]

            ACTORS_DATA = [
                {
                    "email": "actress1@demo.ru",
                    "first_name": "Анастасия",
                    "last_name": "Короткова",
                    "profile": {
                        "first_name": "Анастасия", "last_name": "Короткова",
                        "gender": "female",
                        "date_of_birth": datetime(2000, 3, 15),
                        "city": "Москва",
                        "phone_number": "+79165551001",
                        "email": "actress1@demo.ru",
                        "qualification": "professional",
                        "experience": 4,
                        "about_me": "Окончила ВГИК, специальность «Актёрское мастерство». Снималась в нескольких короткометражных фильмах и рекламных роликах. Владею верховой ездой, бальными танцами и вокалом.",
                        "look_type": "slavic",
                        "hair_color": "blonde",
                        "hair_length": "long",
                        "height": 170,
                        "clothing_size": "44",
                        "shoe_size": "37",
                        "bust_volume": 88,
                        "waist_volume": 63,
                        "hip_volume": 92,
                    },
                    "colors": [(180, 100, 120), (150, 80, 110), (200, 120, 140)],
                },
                {
                    "email": "actress2@demo.ru",
                    "first_name": "Виктория",
                    "last_name": "Романова",
                    "profile": {
                        "first_name": "Виктория", "last_name": "Романова",
                        "gender": "female",
                        "date_of_birth": datetime(1997, 7, 22),
                        "city": "Санкт-Петербург",
                        "phone_number": "+79165551002",
                        "email": "actress2@demo.ru",
                        "qualification": "skilled",
                        "experience": 6,
                        "about_me": "Театральная актриса, окончила РГИСИ. Участница нескольких театральных фестивалей. Снималась в сериалах «Год в Тоскане» и «Столичный патруль». Свободно говорю по-английски.",
                        "look_type": "european",
                        "hair_color": "brunette",
                        "hair_length": "medium",
                        "height": 168,
                        "clothing_size": "42",
                        "shoe_size": "38",
                        "bust_volume": 86,
                        "waist_volume": 61,
                        "hip_volume": 90,
                    },
                    "colors": [(90, 120, 180), (70, 100, 160), (110, 140, 200)],
                },
                {
                    "email": "actor3@demo.ru",
                    "first_name": "Артём",
                    "last_name": "Николаев",
                    "profile": {
                        "first_name": "Артём", "last_name": "Николаев",
                        "gender": "male",
                        "date_of_birth": datetime(1994, 11, 8),
                        "city": "Москва",
                        "phone_number": "+79165551003",
                        "email": "actor3@demo.ru",
                        "qualification": "professional",
                        "experience": 9,
                        "about_me": "Актёр театра и кино. Работал в Московском художественном театре. Снимался в кино- и телефильмах более 9 лет. Занимаюсь боксом, вождением, имею мотоциклетные права.",
                        "look_type": "european",
                        "hair_color": "brown",
                        "hair_length": "short",
                        "height": 183,
                        "clothing_size": "50",
                        "shoe_size": "43",
                        "bust_volume": None,
                        "waist_volume": None,
                        "hip_volume": None,
                    },
                    "colors": [(80, 160, 100), (60, 140, 80), (100, 180, 120)],
                },
            ]

            created_ids = {"admins": [], "actors": [], "castings": [], "responses": []}

            async with async_session_maker() as session:
                # 1. Create admins
                admin_users = []
                for d in ADMINS_DATA:
                    existing = (await session.execute(
                        select(User).where(User.email == d["email"])
                    )).unique().scalar_one_or_none()
                    if existing:
                        if force:
                            existing.password_hash = hash_pw(ADMIN_PASSWORD)
                            existing.is_active = True
                            existing.is_employer_verified = True
                            existing.role = ModelRoles.employer
                        admin_users.append(existing)
                        created_ids["admins"].append(existing.id)
                        continue
                    u = User(
                        email=d["email"],
                        password_hash=hash_pw(ADMIN_PASSWORD),
                        first_name=d["first_name"],
                        last_name=d["last_name"],
                        middle_name=d.get("middle_name"),
                        phone_number=d["phone_number"],
                        telegram_nick=d.get("telegram_nick"),
                        role=ModelRoles.employer,
                        is_active=True,
                        is_employer_verified=True,
                    )
                    session.add(u)
                    await session.flush()
                    admin_users.append(u)
                    created_ids["admins"].append(u.id)

                # 1b. Create agents
                for d in AGENTS_DATA:
                    existing = (await session.execute(
                        select(User).where(User.email == d["email"])
                    )).unique().scalar_one_or_none()
                    if existing:
                        if force:
                            existing.password_hash = hash_pw(AGENT_PASSWORD)
                            existing.is_active = True
                            existing.role = ModelRoles.agent
                        continue
                    ag = User(
                        email=d["email"],
                        password_hash=hash_pw(AGENT_PASSWORD),
                        first_name=d["first_name"],
                        last_name=d["last_name"],
                        phone_number=d["phone_number"],
                        telegram_nick=d.get("telegram_nick"),
                        role=ModelRoles.agent,
                        is_active=True,
                    )
                    session.add(ag)
                    await session.flush()

                # 2. Create projects and castings
                all_castings = []
                for idx, admin in enumerate(admin_users):
                    if idx >= len(PROJECTS_DATA):
                        break
                    proj_data = PROJECTS_DATA[idx]

                    existing_proj = (await session.execute(
                        select(Casting).where(
                            Casting.owner_id == admin.id,
                            Casting.title == proj_data["title"],
                            Casting.parent_project_id == None,
                        )
                    )).unique().scalar_one_or_none()

                    if existing_proj:
                        parent = existing_proj
                        if force:
                            parent.status = CastingStatusEnum.published
                    else:
                        parent = Casting(
                            owner_id=admin.id,
                            title=proj_data["title"],
                            description=proj_data["description"],
                            status=CastingStatusEnum.published,
                        )
                        session.add(parent)
                        await session.flush()

                    created_ids["castings"].append(parent.id)

                    for cast_data in proj_data.get("castings", []):
                        existing_cast = (await session.execute(
                            select(Casting).where(
                                Casting.parent_project_id == parent.id,
                                Casting.title == cast_data["title"],
                            )
                        )).unique().scalar_one_or_none()

                        if existing_cast:
                            if force:
                                existing_cast.status = CastingStatusEnum.published
                            all_castings.append(existing_cast)
                            created_ids["castings"].append(existing_cast.id)
                        else:
                            c = Casting(
                                owner_id=admin.id,
                                title=cast_data["title"],
                                description=cast_data["description"],
                                status=CastingStatusEnum.published,
                                parent_project_id=parent.id,
                            )
                            session.add(c)
                            await session.flush()
                            all_castings.append(c)
                            created_ids["castings"].append(c.id)

                # 3. Create actor users + profiles + photos + responses
                for actor_data in ACTORS_DATA:
                    existing_actor = (await session.execute(
                        select(User).where(User.email == actor_data["email"])
                    )).unique().scalar_one_or_none()

                    if existing_actor:
                        if force:
                            existing_actor.password_hash = hash_pw(ACTOR_PASSWORD)
                            existing_actor.is_active = True
                        actor_user = existing_actor
                    else:
                        actor_user = User(
                            email=actor_data["email"],
                            password_hash=hash_pw(ACTOR_PASSWORD),
                            first_name=actor_data["first_name"],
                            last_name=actor_data["last_name"],
                            role=ModelRoles.user,
                            is_active=True,
                        )
                        session.add(actor_user)
                        await session.flush()

                    created_ids["actors"].append(actor_user.id)

                    # Create actor_profile (new system)
                    existing_ap = (await session.execute(
                        select(ActorProfile).where(ActorProfile.user_id == actor_user.id)
                    )).unique().scalar_one_or_none()

                    if existing_ap and force:
                        from sqlalchemy import delete as sa_delete
                        await session.execute(
                            sa_delete(MediaAsset).where(MediaAsset.actor_profile_id == existing_ap.id)
                        )
                        await session.flush()
                        actor_name = f"{actor_data['first_name']} {actor_data['last_name']}"
                        colors = actor_data.get("colors", [(120, 120, 120)])
                        photo_url = await upload_avatar_to_s3(existing_ap.id, actor_name, colors)
                        if photo_url:
                            actor_user.photo_url = photo_url
                        await session.flush()

                    if not existing_ap:
                        pd = actor_data["profile"]
                        ap = ActorProfile(
                            user_id=actor_user.id,
                            first_name=pd["first_name"],
                            last_name=pd["last_name"],
                            display_name=f"{pd['last_name']} {pd['first_name']}",
                            gender=pd.get("gender"),
                            date_of_birth=pd.get("date_of_birth"),
                            city=pd.get("city"),
                            phone_number=pd.get("phone_number"),
                            email=pd.get("email"),
                            qualification=pd.get("qualification"),
                            experience=pd.get("experience"),
                            about_me=pd.get("about_me"),
                            look_type=pd.get("look_type"),
                            hair_color=pd.get("hair_color"),
                            hair_length=pd.get("hair_length"),
                            height=pd.get("height"),
                            clothing_size=pd.get("clothing_size"),
                            shoe_size=pd.get("shoe_size"),
                            bust_volume=pd.get("bust_volume"),
                            waist_volume=pd.get("waist_volume"),
                            hip_volume=pd.get("hip_volume"),
                            is_active=True,
                        )
                        session.add(ap)
                        await session.flush()

                        await session.flush()

                        actor_name = f"{actor_data['first_name']} {actor_data['last_name']}"
                        colors = actor_data.get("colors", [(120, 120, 120)])
                        photo_url = await upload_avatar_to_s3(ap.id, actor_name, colors)
                        if photo_url:
                            actor_user.photo_url = photo_url
                        await session.flush()

                    # Also create legacy profile + responses to castings
                    existing_profile = (await session.execute(
                        select(Profile).where(Profile.user_id == actor_user.id)
                    )).unique().scalar_one_or_none()

                    if not existing_profile:
                        pd = actor_data["profile"]
                        legacy_p = Profile(
                            user_id=actor_user.id,
                            first_name=pd["first_name"],
                            last_name=pd["last_name"],
                            gender=pd.get("gender"),
                            date_of_birth=pd.get("date_of_birth").date() if pd.get("date_of_birth") else None,
                            phone_number=pd.get("phone_number"),
                            email=pd.get("email"),
                            city_full=None,
                            qualification=None,
                            experience=pd.get("experience"),
                            about_me=pd.get("about_me"),
                            height=pd.get("height"),
                            clothing_size=pd.get("clothing_size"),
                            shoe_size=pd.get("shoe_size"),
                            bust_volume=pd.get("bust_volume"),
                            waist_volume=pd.get("waist_volume"),
                            hip_volume=pd.get("hip_volume"),
                        )
                        session.add(legacy_p)
                        await session.flush()

                        # Make actor respond to all published castings
                        for cast in all_castings:
                            existing_resp = (await session.execute(
                                select(Response).where(
                                    Response.profile_id == legacy_p.id,
                                    Response.casting_id == cast.id,
                                )
                            )).unique().scalar_one_or_none()
                            if not existing_resp:
                                resp = Response(
                                    profile_id=legacy_p.id,
                                    casting_id=cast.id,
                                    status="pending",
                                    created_at=datetime.now(timezone.utc) - timedelta(hours=len(all_castings) - all_castings.index(cast)),
                                )
                                session.add(resp)
                                created_ids["responses"].append(cast.id)

                await session.commit()

            return {
                "ok": True,
                "message": "Демо-данные успешно созданы!",
                "created": created_ids,
                "credentials": {
                    "admins": [{"email": d["email"], "password": ADMIN_PASSWORD} for d in ADMINS_DATA],
                    "actors": [{"email": d["email"], "password": ACTOR_PASSWORD} for d in ACTORS_DATA],
                    "agents": [{"email": d["email"], "password": AGENT_PASSWORD} for d in AGENTS_DATA],
                }
            }
