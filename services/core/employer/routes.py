"""
Employer & Actor Routes — разделение прав по ролям.

SuperAdmin (owner): полный доступ, удаление любых анкет/проектов.
Admin/Employer: CRUD своих проектов, просмотр только откликнувшихся актёров.
Actor (user): профиль, лента проектов, отклики, история.
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Body, Request, Response, UploadFile, File
from typing import Optional
import base64
import hashlib
import hmac
import json
import logging
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

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

        def _looks_like_email(value: str) -> bool:
            return "@" in value and not value.strip().startswith("@")

        def _normalize_telegram_username(value: str) -> str:
            import re

            username = value.strip()
            username = re.sub(r"^https?://t\.me/", "", username, flags=re.IGNORECASE)
            username = re.sub(r"^https?://telegram\.me/", "", username, flags=re.IGNORECASE)
            username = re.sub(r"^t\.me/", "", username, flags=re.IGNORECASE)
            username = username.split("?", 1)[0].split("#", 1)[0].strip().strip("/").lstrip("@")
            if not re.fullmatch(r"[A-Za-z0-9_]{5,32}", username):
                raise HTTPException(status_code=400, detail="Укажите корректный email или Telegram username")
            return username

        async def _find_user_by_identifier(session, User, identifier: str):
            from sqlalchemy import func, or_, select

            value = identifier.strip()
            if not value:
                raise HTTPException(status_code=400, detail="Email или Telegram username пользователя обязателен")

            if _looks_like_email(value):
                return (await session.execute(
                    select(User).where(func.lower(User.email) == value.lower())
                )).scalar_one_or_none()

            username = _normalize_telegram_username(value)
            username_lower = username.lower()
            username_with_at = f"@{username_lower}"
            user = (await session.execute(
                select(User)
                .where(or_(
                    func.lower(User.telegram_username) == username_lower,
                    func.lower(User.telegram_username) == username_with_at,
                    func.lower(User.telegram_nick) == username_lower,
                    func.lower(User.telegram_nick) == username_with_at,
                    func.lower(func.replace(User.telegram_username, "@", "")) == username_lower,
                    func.lower(func.replace(User.telegram_nick, "@", "")) == username_lower,
                ))
                .limit(1)
            )).scalar_one_or_none()
            if user:
                return user

            candidates = (await session.execute(
                select(User)
                .where(or_(
                    func.lower(User.telegram_username).like(f"%{username_lower}%"),
                    func.lower(User.telegram_nick).like(f"%{username_lower}%"),
                ))
                .limit(20)
            )).scalars().all()
            for candidate in candidates:
                for raw in (getattr(candidate, "telegram_username", None), getattr(candidate, "telegram_nick", None)):
                    if not raw:
                        continue
                    try:
                        if _normalize_telegram_username(str(raw)).lower() == username_lower:
                            return candidate
                    except HTTPException:
                        continue

            return None

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

        @self.router.get("/team-workspace/")
        async def get_team_workspace(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Профиль командного рабочего пространства текущего пользователя."""
            from postgres.database import async_session_maker
            from castings.models import Casting
            from profiles.models import Response
            from reports.models import Report
            from users.models import User
            from sqlalchemy import select, func, text

            user_id = int(authorized.id)
            role = authorized.role

            async with async_session_maker() as session:
                await EmployerService._ensure_admin_team_table(session)
                membership_rows = (await session.execute(
                    text(
                        "SELECT owner_id, role, created_at FROM admin_team_members "
                        "WHERE user_id = :uid ORDER BY created_at DESC"
                    ),
                    {"uid": user_id},
                )).all()

                items = []
                seen_owner_ids = set()
                for membership in membership_rows:
                    owner_id = int(membership.owner_id or 0)
                    if not owner_id or owner_id == user_id or owner_id in seen_owner_ids:
                        continue
                    seen_owner_ids.add(owner_id)

                    projects = (await session.execute(
                        select(Casting)
                        .where(Casting.parent_project_id == None, Casting.owner_id == owner_id)
                        .order_by(Casting.created_at.desc())
                        .limit(200)
                    )).scalars().unique().all()

                    project_ids = [int(project.id) for project in projects]
                    if project_ids:
                        sub_ids = [
                            int(row[0]) for row in (
                                await session.execute(
                                    select(Casting.id).where(Casting.parent_project_id.in_(project_ids))
                                )
                            ).all()
                        ]
                    else:
                        sub_ids = []
                    all_ids = project_ids + sub_ids

                    collab_count = (await session.execute(
                        text(
                            "SELECT COUNT(*) FROM admin_team_members WHERE owner_id = :oid"
                        ),
                        {"oid": owner_id},
                    )).scalar() or 0
                    response_count = 0
                    report_count = 0
                    if all_ids:
                        response_count = (await session.execute(
                            select(func.count()).select_from(Response).where(Response.casting_id.in_(all_ids))
                        )).scalar() or 0
                        report_count = (await session.execute(
                            select(func.count()).select_from(Report).where(Report.casting_id.in_(all_ids))
                        )).scalar() or 0
                    owner = await session.get(User, owner_id)
                    owner_name = None
                    if owner:
                        parts = [p for p in [owner.first_name, owner.last_name] if p]
                        owner_name = " ".join(parts) if parts else owner.email
                    latest_project = projects[0] if projects else None

                    items.append({
                        "id": owner_id,
                        "title": owner_name or f"Пользователь #{owner_id}",
                        "description": None,
                        "owner_id": owner_id,
                        "owner_name": owner_name,
                        "membership_role": membership.role or "editor",
                        "sub_castings_count": len(sub_ids),
                        "projects_count": len(project_ids),
                        "team_size": int(collab_count) + 1,
                        "response_count": int(response_count),
                        "report_count": int(report_count),
                        "created_at": str(getattr(latest_project, "created_at", membership.created_at)),
                    })

                return {
                    "role": role,
                    "is_team_member": bool(items),
                    "teams": items,
                    "total": len(items),
                }

        @self.router.get("/admin-team/")
        async def get_admin_team(
            authorized: JWT = Depends(employer_authorized),
        ):
            """Команда профиля Админ PRO/SuperAdmin: не по кастингу, а по владельцу."""
            if authorized.role not in TEAM_MANAGER_ROLES:
                raise HTTPException(status_code=403, detail=TEAM_FEATURE_ERROR)
            from postgres.database import async_session_maker
            from users.models import User
            from sqlalchemy import select, text

            owner_id = int(authorized.id)
            async with async_session_maker() as session:
                await EmployerService._ensure_admin_team_table(session)
                rows = (await session.execute(
                    text(
                        "SELECT id, user_id, role, created_at FROM admin_team_members "
                        "WHERE owner_id = :oid ORDER BY created_at DESC"
                    ),
                    {"oid": owner_id},
                )).all()
                items = []
                for row in rows:
                    user = await session.get(User, int(row.user_id))
                    items.append({
                        "id": row.id,
                        "user_id": row.user_id,
                        "email": user.email if user else None,
                        "telegram_username": getattr(user, 'telegram_username', None) if user else None,
                        "telegram_nick": getattr(user, 'telegram_nick', None) if user else None,
                        "first_name": getattr(user, 'first_name', None) if user else None,
                        "last_name": getattr(user, 'last_name', None) if user else None,
                        "photo_url": getattr(user, 'photo_url', None) if user else None,
                        "user_role": _user_role_value(user),
                        "role": row.role,
                        "created_at": str(row.created_at),
                    })
                return {"members": items, "total": len(items)}

        @self.router.post("/admin-team/")
        async def add_admin_team_member(
            user_identifier: Optional[str] = Query(None, description="Email или Telegram username пользователя"),
            user_email: Optional[str] = Query(None, description="Email пользователя"),
            role: str = Query("editor", description="editor или viewer"),
            body: Optional[dict] = Body(None),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Добавить человека в профильную команду Админ PRO/SuperAdmin со сквозным доступом."""
            if role not in {"editor", "viewer"}:
                raise HTTPException(status_code=400, detail="Роль участника должна быть editor или viewer")
            if authorized.role not in TEAM_MANAGER_ROLES:
                raise HTTPException(status_code=403, detail=TEAM_FEATURE_ERROR)
            from postgres.database import async_session_maker
            from users.models import User
            from billing.service import BillingService
            from sqlalchemy import select, text

            owner_id = int(authorized.id)
            payload = body if isinstance(body, dict) else {}
            identifier = str(
                payload.get("user_identifier")
                or payload.get("identifier")
                or payload.get("user_email")
                or user_identifier
                or user_email
                or ""
            ).strip()

            async with async_session_maker() as session:
                await EmployerService._ensure_admin_team_table(session)
                user = await _find_user_by_identifier(session, User, identifier)
                if not user:
                    raise HTTPException(status_code=404, detail="Пользователь не найден")
                if int(user.id) == owner_id:
                    raise HTTPException(status_code=409, detail="Нельзя добавить самого себя")

                inviter_is_superadmin = authorized.role == Roles.owner.value
                target_role = _user_role_value(user)
                admin_target_roles = [
                    Roles.employer.value,
                    Roles.employer_pro.value,
                    Roles.administrator.value,
                    Roles.manager.value,
                ]
                if not inviter_is_superadmin and target_role not in admin_target_roles:
                    raise HTTPException(status_code=403, detail="В команду можно добавить только Админа или Админа PRO")
                if not inviter_is_superadmin and target_role in [Roles.employer.value, Roles.employer_pro.value]:
                    if not await BillingService.has_active_subscription(int(user.id)):
                        raise HTTPException(status_code=403, detail="У приглашённого Админа должна быть активная подписка")

                existing = (await session.execute(
                    text(
                        "SELECT id FROM admin_team_members WHERE owner_id = :oid AND user_id = :uid"
                    ),
                    {"oid": owner_id, "uid": int(user.id)},
                )).scalar_one_or_none()
                if existing:
                    raise HTTPException(status_code=409, detail="Пользователь уже добавлен")

                row = (await session.execute(
                    text(
                        "INSERT INTO admin_team_members(owner_id, user_id, role) "
                        "VALUES (:oid, :uid, :role) RETURNING id"
                    ),
                    {"oid": owner_id, "uid": int(user.id), "role": role},
                )).scalar_one()
                await session.commit()
                return {
                    "ok": True,
                    "id": row,
                    "owner_id": owner_id,
                    "user_id": int(user.id),
                    "email": user.email,
                    "telegram_username": getattr(user, 'telegram_username', None),
                    "telegram_nick": getattr(user, 'telegram_nick', None),
                    "role": role,
                }

        @self.router.delete("/admin-team/{member_id}/")
        async def remove_admin_team_member(
            member_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            if authorized.role not in TEAM_MANAGER_ROLES:
                raise HTTPException(status_code=403, detail=TEAM_FEATURE_ERROR)
            from postgres.database import async_session_maker
            from sqlalchemy import text
            async with async_session_maker() as session:
                await EmployerService._ensure_admin_team_table(session)
                result = await session.execute(
                    text(
                        "DELETE FROM admin_team_members WHERE id = :mid AND owner_id = :oid RETURNING id"
                    ),
                    {"mid": member_id, "oid": int(authorized.id)},
                )
                removed = result.scalar_one_or_none()
                if not removed:
                    raise HTTPException(status_code=404, detail="Участник не найден")
                await session.commit()
                return {"ok": True, "removed_id": removed}

        @self.router.post("/", response_model=SProjectData)
        async def create_project(
            data: SProjectCreate,
            team_owner_id: Optional[int] = Query(None, description="ID владельца команды из раздела Где я работаю"),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Создать проект (объявление о наборе)."""
            if team_owner_id is not None and int(team_owner_id) != int(authorized.id):
                from postgres.database import async_session_maker
                async with async_session_maker() as session:
                    await EmployerService._resolve_owner_scope(session, authorized, team_owner_id)
            else:
                await _check_employer_verified(authorized.id, authorized.role)
            return await EmployerService.create_project(
                user_token=authorized, title=data.title, description=data.description,
                team_owner_id=team_owner_id,
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
            from sqlalchemy import select, or_
            async with async_session_maker() as session:
                user = await session.get(User, int(authorized.id))
                ticket = (await session.execute(
                    select(VerificationTicket)
                    .where(
                        VerificationTicket.user_id == int(authorized.id),
                        or_(
                            VerificationTicket.company_name != '__SUPPORT__',
                            VerificationTicket.company_name.is_(None),
                        ),
                    )
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
            phone_number: str = Query("", description="Номер телефона"),
            telegram_username: str = Query("", description="Telegram username"),
            about_text: str = Query("", description="Чем занимаетесь"),
            projects_text: str = Query("", description="Какие проекты планируете"),
            experience_text: str = Query("", description="Опыт в индустрии"),
            body: Optional[dict] = Body(None),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Employer: отправить заявку на верификацию."""
            if authorized.role in ['owner', Roles.owner.value]:
                return {"error": "SuperAdmin не нуждается в верификации"}
            if authorized.role not in [Roles.employer.value, Roles.employer_pro.value, 'employer', 'employer_pro']:
                raise HTTPException(status_code=403, detail="Только Админ или Админ PRO может отправить заявку на верификацию")
            from postgres.database import async_session_maker
            from users.models import User, VerificationTicket, TicketMessage
            from sqlalchemy import select, or_
            try:
                payload = body if isinstance(body, dict) else {}
                company_name = str(payload.get("company_name") or company_name or "").strip()
                phone_number = str(payload.get("phone_number") or phone_number or "").strip()
                telegram_username_raw = str(payload.get("telegram_username") or telegram_username or "").strip()
                about_text = str(payload.get("about_text") or about_text or "").strip()
                projects_text = str(payload.get("projects_text") or projects_text or "").strip()
                experience_text = str(payload.get("experience_text") or experience_text or "").strip()
                if not company_name or not phone_number or not telegram_username_raw or not about_text or not projects_text or not experience_text:
                    raise HTTPException(status_code=400, detail="Ответьте на все вопросы верификации")

                import re

                phone_digits = re.sub(r"\D+", "", phone_number)
                if len(phone_digits) < 7:
                    raise HTTPException(status_code=400, detail="Укажите корректный номер телефона")

                telegram_username_norm = telegram_username_raw.strip()
                telegram_username_norm = re.sub(r"^https?://t\.me/", "", telegram_username_norm, flags=re.IGNORECASE)
                telegram_username_norm = re.sub(r"^t\.me/", "", telegram_username_norm, flags=re.IGNORECASE)
                telegram_username_norm = telegram_username_norm.strip().strip("/").lstrip("@")
                if not re.fullmatch(r"[A-Za-z0-9_]{5,32}", telegram_username_norm):
                    raise HTTPException(status_code=400, detail="Укажите корректный Telegram username, например @username")
                telegram_username_display = f"@{telegram_username_norm}"

                async with async_session_maker() as session:
                    user = await session.get(User, int(authorized.id))
                    if not user:
                        raise HTTPException(status_code=404, detail="Пользователь не найден")

                    existing = (await session.execute(
                        select(VerificationTicket).where(
                            VerificationTicket.user_id == int(authorized.id),
                            VerificationTicket.status == 'open',
                            or_(
                                VerificationTicket.company_name != '__SUPPORT__',
                                VerificationTicket.company_name.is_(None),
                            ),
                        )
                    )).scalar_one_or_none()
                    if existing:
                        raise HTTPException(status_code=400, detail="У вас уже есть открытая заявка")

                    user.phone_number = phone_number
                    user.telegram_nick = telegram_username_display

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
                    intro += f"📞 Телефон: {phone_number}\n"
                    intro += f"📨 Telegram: {telegram_username_display}\n"
                    if about_text:
                        intro += f"💼 О себе: {about_text}\n"
                    if projects_text:
                        intro += f"🎬 Съёмки: {projects_text}\n"
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
                            push=True,
                            url=f"/dashboard/admin?tab=tickets&ticket_id={ticket.id}",
                            data={"ticket_id": ticket.id, "ticket_type": "verification"},
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
            from users.models import User, VerificationTicket, TicketMessage
            from sqlalchemy import select
            from crm.service import NotificationService
            from crm.models import NotificationType
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
                try:
                    user = await session.get(User, int(authorized.id))
                    sender_name = (
                        f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
                        if user else f"User #{authorized.id}"
                    ) or (user.email if user else f"User #{authorized.id}")
                    await NotificationService.notify_superadmins(
                        type=NotificationType.SYSTEM,
                        title="Новое сообщение в тикете",
                        message=f"От {sender_name}: {message[:140]}",
                        push=True,
                        url=f"/dashboard/admin?tab=tickets&ticket_id={ticket.id}",
                        data={"ticket_id": ticket.id, "ticket_type": "verification"},
                    )
                except Exception:
                    pass
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
                        push=True,
                        url=f"/dashboard/admin?tab=tickets&ticket_id={ticket.id}",
                        data={"ticket_id": ticket.id, "ticket_type": "support"},
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
                        role_label = {
                            'employer': 'Админ',
                            'employer_pro': 'Админ PRO',
                            'administrator': 'Админ',
                            'manager': 'Админ PRO',
                        }.get(sender_role, '')
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
            team_owner_id: Optional[int] = Query(None, description="ID владельца команды из раздела Где я работаю"),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Список моих проектов (employer видит только свои, superadmin — все)."""
            return await EmployerService.get_my_projects(
                user_token=authorized,
                page=page,
                page_size=page_size,
                archived=archived,
                team_owner_id=team_owner_id,
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
            team_owner_id: Optional[int] = Query(None, description="ID владельца команды из раздела Где я работаю"),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Опубликовать свой проект (доступно для Админ/Админ PRO/owner)."""
            if team_owner_id is not None and int(team_owner_id) != int(authorized.id):
                from postgres.database import async_session_maker
                async with async_session_maker() as session:
                    await EmployerService._resolve_owner_scope(session, authorized, team_owner_id)
            else:
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

        @self.router.post("/{casting_id}/telegram-resync/")
        async def resync_casting_to_channel(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Переотправить пост кастинга в Telegram-канал.

            Публикация в канал — best-effort, и если Telegram не принял пост
            (недоступная обложка, сетевой сбой), кастинг остаётся без поста.
            Раньше починить это можно было только снятием с публикации и
            повторной публикацией — теперь есть прямая кнопка.
            """
            return await EmployerService.resync_casting_to_channel(
                user_token=authorized, casting_id=casting_id
            )

        @self.router.get("/{casting_id}/edit-data/")
        async def get_casting_edit_data(
            casting_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Полные поля кастинга для формы редактирования."""
            return await EmployerService.get_casting_edit_data(
                user_token=authorized, casting_id=casting_id
            )

        @self.router.patch("/{casting_id}/full/")
        async def update_casting_full(
            casting_id: int,
            body: dict = Body(...),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Обновить поля кастинга (для редактирования черновика)."""
            return await EmployerService.update_casting_fields(
                user_token=authorized, casting_id=casting_id, fields=body
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
            position_x: int = Query(50, ge=0, le=100),
            position_y: int = Query(0, ge=0, le=100),
            request: Request = None,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Загрузить фото для кастинга."""
            return await EmployerService.upload_casting_image(
                user_token=authorized,
                casting_id=casting_id,
                image=image,
                base_url=str(request.base_url).rstrip("/") if request else "",
                position_x=position_x,
                position_y=position_y,
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
                position_x=body.get("image_position_x", body.get("position_x", 50)),
                position_y=body.get("image_position_y", body.get("position_y", 0)),
            )

        @self.router.patch("/{casting_id}/image-position/")
        async def update_casting_image_position(
            casting_id: int,
            body: dict = Body(...),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Подогнать позицию обложки кастинга в карточках."""
            return await EmployerService.update_casting_image_position(
                user_token=authorized,
                casting_id=casting_id,
                position_x=body.get("image_position_x", body.get("position_x", 50)),
                position_y=body.get("image_position_y", body.get("position_y", 0)),
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

        @self.router.get("/{casting_id}/public-detail/")
        async def get_public_casting(casting_id: int):
            """Публичный просмотр кастинга (без авторизации) — для перехода из
            Telegram-канала. Возвращает только published кастинги."""
            return await EmployerService.get_public_casting(casting_id=casting_id)

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
            from castings.models import Casting, ProjectCollaborator
            from sqlalchemy import select

            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Casting not found")
                if not await EmployerService._has_team_access(session, authorized, casting):
                    raise HTTPException(status_code=403, detail="Not your team casting")

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

        # Роли, которым разрешена командная работа (создание/удаление коллабораторов).
        # Регулярный Админ (employer) НЕ может управлять командой —
        # это привилегия подписки Админ PRO (employer_pro) и системных ролей.
        # Должно быть синхронизировано с frontend canManageTeam (shared/use-role.ts).
        TEAM_MANAGER_ROLES = frozenset({
            Roles.owner.value,
            Roles.administrator.value,
            Roles.manager.value,
            Roles.employer_pro.value,
        })
        TEAM_FEATURE_ERROR = (
            "Командная работа доступна только в подписке Админ PRO. "
            "Перейдите на Админ PRO, чтобы добавлять других админов в свои кастинги."
        )

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
            if authorized.role not in TEAM_MANAGER_ROLES:
                raise HTTPException(status_code=403, detail=TEAM_FEATURE_ERROR)
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from users.models import User
            from sqlalchemy import func, select
            from billing.service import BillingService
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")
                team_casting_id = int(casting.parent_project_id or casting.id)
                team_casting = casting
                if casting.parent_project_id:
                    team_casting = await session.get(Casting, team_casting_id)
                    if not team_casting:
                        raise HTTPException(status_code=404, detail="Project not found")
                team_child_ids_result = await session.execute(
                    select(Casting.id).where(Casting.parent_project_id == team_casting_id)
                )
                team_casting_ids = [team_casting_id] + [row[0] for row in team_child_ids_result.all()]

                if str(team_casting.owner_id) != str(authorized.id) and authorized.role != Roles.owner.value:
                    raise HTTPException(status_code=403, detail="Only project owner can add collaborators")

                normalized_email = user_email.strip().lower()
                if not normalized_email:
                    raise HTTPException(status_code=400, detail="Email пользователя обязателен")

                user_result = await session.execute(
                    select(User).where(func.lower(User.email) == normalized_email)
                )
                user = user_result.scalar_one_or_none()
                if not user:
                    raise HTTPException(status_code=404, detail="Пользователь не найден")

                inviter_is_superadmin = authorized.role == Roles.owner.value
                target_role = _user_role_value(user)
                # Правила добавления в команду кастинга:
                # - SuperAdmin (owner) может добавить пользователя с любой ролью.
                # - Админ / Админ ПРО / administrator / manager могут добавить только
                #   таких же админов (employer / employer_pro / administrator / manager).
                admin_target_roles = [
                    Roles.employer.value,
                    Roles.employer_pro.value,
                    Roles.administrator.value,
                    Roles.manager.value,
                ]
                if not inviter_is_superadmin and target_role not in admin_target_roles:
                    raise HTTPException(
                        status_code=403,
                        detail="В команду можно добавить только Админа или Админа ПРО",
                    )
                # Активная подписка требуется только для приглашений employer/employer_pro
                # (для administrator/manager и suprAdmin — не нужна).
                if not inviter_is_superadmin and target_role in [Roles.employer.value, Roles.employer_pro.value]:
                    if not await BillingService.has_active_subscription(int(user.id)):
                        raise HTTPException(
                            status_code=403,
                            detail="У приглашённого Админа должна быть активная подписка",
                        )

                existing = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id.in_(team_casting_ids),
                        ProjectCollaborator.user_id == user.id,
                    )
                )
                if existing.scalar_one_or_none():
                    raise HTTPException(status_code=409, detail="Пользователь уже добавлен")

                collab = ProjectCollaborator(casting_id=team_casting_id, user_id=user.id, role=role)
                session.add(collab)
                await session.commit()
                return {"ok": True, "casting_id": team_casting_id, "user_id": user.id, "email": user.email, "role": role}

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
                team_casting_id = int(casting.parent_project_id or casting.id)
                payload = {
                    "kind": "project_collab_invite",
                    "casting_id": team_casting_id,
                    "role": role,
                    "created_by": int(authorized.id),
                    "exp": int(time.time()) + expires_in_hours * 3600,
                }
                token = _sign_invite_payload(payload)
                return {"ok": True, "token": token, "casting_id": team_casting_id, "role": role, "expires_in_hours": expires_in_hours}

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
                team_casting_id = int(casting.parent_project_id or casting.id)
                team_casting = casting
                if casting.parent_project_id:
                    team_casting = await session.get(Casting, team_casting_id)
                    if not team_casting:
                        raise HTTPException(status_code=404, detail="Project not found")

                if str(team_casting.owner_id) == str(authorized.id):
                    raise HTTPException(status_code=409, detail="Вы уже являетесь владельцем этого кастинга")
                existing = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == team_casting_id,
                        ProjectCollaborator.user_id == int(authorized.id),
                    )
                )
                collab = existing.scalar_one_or_none()
                if collab:
                    return {"ok": True, "casting_id": team_casting_id, "role": collab.role, "already_joined": True}
                session.add(ProjectCollaborator(
                    casting_id=team_casting_id,
                    user_id=int(authorized.id),
                    role=role,
                ))
                await session.commit()
                return {"ok": True, "casting_id": team_casting_id, "role": role, "already_joined": False}

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
                if not await EmployerService._has_team_access(session, authorized, casting):
                    raise HTTPException(status_code=403, detail="No access to this project")
                team_casting_id = int(casting.parent_project_id or casting.id)
                team_child_ids_result = await session.execute(
                    select(Casting.id).where(Casting.parent_project_id == team_casting_id)
                )
                team_casting_ids = [team_casting_id] + [row[0] for row in team_child_ids_result.all()]

                result = await session.execute(
                    select(ProjectCollaborator).where(ProjectCollaborator.casting_id.in_(team_casting_ids))
                )
                collabs = result.scalars().all()
                items = []
                seen_user_ids = set()
                for c in collabs:
                    if c.user_id in seen_user_ids:
                        continue
                    seen_user_ids.add(c.user_id)
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
            if authorized.role not in TEAM_MANAGER_ROLES:
                raise HTTPException(status_code=403, detail=TEAM_FEATURE_ERROR)
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from sqlalchemy import select
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Project not found")
                team_casting_id = int(casting.parent_project_id or casting.id)
                team_casting = casting
                if casting.parent_project_id:
                    team_casting = await session.get(Casting, team_casting_id)
                    if not team_casting:
                        raise HTTPException(status_code=404, detail="Project not found")
                team_child_ids_result = await session.execute(
                    select(Casting.id).where(Casting.parent_project_id == team_casting_id)
                )
                team_casting_ids = [team_casting_id] + [row[0] for row in team_child_ids_result.all()]

                if str(team_casting.owner_id) != str(authorized.id) and authorized.role != Roles.owner.value:
                    raise HTTPException(status_code=403, detail="Only project owner can remove collaborators")

                collab = await session.get(ProjectCollaborator, collab_id)
                if not collab or collab.casting_id not in team_casting_ids:
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
            request: Request = None,
            team_owner_id: Optional[int] = Query(None, description="ID владельца команды из раздела Где я работаю"),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Создать кастинг внутри проекта."""
            from postgres.database import async_session_maker
            from castings.models import Casting, ProjectCollaborator
            from users.models import User
            from sqlalchemy import select

            title = (body.get("title") or "").strip()
            if not title:
                raise HTTPException(status_code=422, detail="Заголовок обязателен")

            is_team_mode = team_owner_id is not None and int(team_owner_id) != int(authorized.id)

            try:
                async with async_session_maker() as session:
                    if is_team_mode:
                        # Проверяем, что пользователь состоит в команде указанного
                        # владельца (или является Админ/Менеджер) — свою верификацию
                        # employer в этом случае не требуем, работает от имени команды.
                        await EmployerService._resolve_owner_scope(session, authorized, team_owner_id)
                    else:
                        await _check_employer_verified(authorized.id, authorized.role)

                    project = await session.get(Casting, project_id)
                    if not project:
                        raise HTTPException(status_code=404, detail="Project not found")

                    has_access = (
                        str(project.owner_id) == str(authorized.id) or
                        authorized.role in ['owner', Roles.owner.value] or
                        # _resolve_owner_scope выше уже проверил, что пользователь состоит
                        # в команде team_owner_id (или Админ/Менеджер) — тут только
                        # убеждаемся, что проект действительно принадлежит этому владельцу.
                        (is_team_mode and str(project.owner_id) == str(team_owner_id))
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
                    requested_status = str(body.get("status") or "published").lower()
                    is_draft = requested_status in {"draft", "unpublished"}
                    image_b64 = (body.get("image_base64") or "").strip()
                    should_publish = not is_draft
                    # If a cover is included inline, keep the casting unpublished
                    # until the image is stored. Then publish once, with the image
                    # already present, so the Telegram channel post is a photo post.
                    create_as_draft_for_cover = should_publish and bool(image_b64)
                    casting = Casting(
                        title=title,
                        description=body.get("description") or "-",
                        owner_id=int(authorized.id),
                        parent_project_id=project_id,
                        status=CastingStatusEnum.unpublished if (is_draft or create_as_draft_for_cover) else CastingStatusEnum.published,
                        city=body.get("city") or None,
                        project_category=body.get("project_category") or None,
                        role_types=body.get("role_types") or None,
                        gender=body.get("gender") or None,
                        age_from=body.get("age_from"),
                        age_to=body.get("age_to"),
                        financial_conditions=body.get("financial_conditions") or None,
                        shooting_dates=body.get("shooting_dates") or None,
                    )
                    if should_publish and not create_as_draft_for_cover:
                        casting.published_by_id = int(authorized.id)
                    session.add(casting)
                    await session.flush()
                    await session.commit()
                    await session.refresh(casting)

                    # Attach the cover (if provided inline) BEFORE publishing to the
                    # Telegram channel, so the channel post is created with the image
                    # instead of as a text-only post. For published castings the image
                    # service already (re)publishes the channel post with the cover.
                    inline_image_url = None
                    if image_b64:
                        try:
                            upload_res = await EmployerService.upload_casting_image_base64(
                                user_token=authorized,
                                casting_id=casting.id,
                                image_base64=image_b64,
                                base_url=str(request.base_url).rstrip("/") if request else "",
                                position_x=body.get("image_position_x", 50),
                                position_y=body.get("image_position_y", 0),
                            )
                            inline_image_url = (upload_res or {}).get("image_url")
                            if not inline_image_url:
                                raise RuntimeError("сервер не вернул ссылку на сохранённую обложку")
                        except Exception as exc:
                            import logging as _logging
                            _logging.getLogger(__name__).warning(
                                "Inline cover upload failed for new casting %s: %s", casting.id, exc
                            )
                            # Кастинг специально создан в статусе unpublished.
                            # Не переводим его в published и не отправляем в
                            # Telegram без выбранной админом обложки. Черновик
                            # останется доступен — фото можно загрузить повторно.
                            raise HTTPException(
                                status_code=502,
                                detail=(
                                    "Кастинг сохранён как черновик, но обложка не загрузилась. "
                                    "Повторите загрузку — без выбранной обложки кастинг не опубликован."
                                ),
                            ) from exc

                    if create_as_draft_for_cover:
                        casting.status = CastingStatusEnum.published
                        casting.published_by_id = int(authorized.id)
                        await session.commit()
                        await session.refresh(casting)

                    if not is_draft:
                        try:
                            creator = await session.get(User, int(authorized.id))
                            creator_name = EmployerService._display_user_name(creator, f"User #{authorized.id}")
                            await NotificationService.notify_superadmins(
                                type=NotificationType.CASTING_PUBLISHED,
                                title="Кастинг опубликован",
                                message=f"🎬 {creator_name} создал кастинг «{casting.title}».",
                                casting_id=casting.id,
                                exclude_user_id=int(authorized.id),
                            )
                            await NotificationService.notify_project_team(
                                casting_id=casting.id,
                                type=NotificationType.CASTING_PUBLISHED,
                                title="Кастинг создан",
                                message=f"🎬 {creator_name} создал кастинг «{casting.title}».",
                                exclude_user_id=int(authorized.id),
                            )
                        except Exception:
                            pass

                        # Уведомляем подходящих актёров/агентов о новом кастинге (фоном).
                        EmployerService.schedule_matching_actor_notifications(
                            casting.id, int(authorized.id)
                        )

                        await EmployerService._publish_to_channel_with_alert(session, casting)

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
                        "image_url": inline_image_url,
                        "image_position": (
                            f"{EmployerService._normalize_cover_position(body.get('image_position_x', 50), 50)}% "
                            f"{EmployerService._normalize_cover_position(body.get('image_position_y', 0), 0)}%"
                        ),
                        "image_position_x": EmployerService._normalize_cover_position(body.get("image_position_x", 50), 50),
                        "image_position_y": EmployerService._normalize_cover_position(body.get("image_position_y", 0), 0),
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
            from castings.models import Casting
            from profiles.models import Response
            from sqlalchemy import select, func
            async with async_session_maker() as session:
                project = await session.get(Casting, project_id)
                if not project:
                    raise HTTPException(status_code=404, detail="Project not found")

                if not await EmployerService._has_team_access(session, authorized, project):
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
                    image_meta = await EmployerService._get_casting_image_meta(session, c.id, casting=c)
                    items.append({
                        "id": c.id,
                        "title": c.title,
                        "description": c.description,
                        "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                        "response_count": resp_count,
                        "created_at": str(c.created_at),
                        "image_url": image_meta["image_url"],
                        "image_position": image_meta["image_position"],
                        "image_position_x": image_meta["image_position_x"],
                        "image_position_y": image_meta["image_position_y"],
                        "owner_id": getattr(c, 'owner_id', None) or 0,
                        "parent_project_id": project_id,
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
        # Admin Team Chat
        # ──────────────────────────────────────────────

        def _display_chat_user(user) -> tuple[str, str]:
            if not user:
                return "Система", "system"
            role = user.role.value if hasattr(user.role, 'value') else str(user.role)
            name = " ".join([p for p in [user.first_name, user.last_name] if p]).strip()
            return name or user.email or f"User #{user.id}", role

        async def _can_access_admin_team_chat(session, authorized: JWT, owner_id: int) -> bool:
            from sqlalchemy import text

            user_id = int(authorized.id)
            role = authorized.role
            if owner_id == user_id:
                return True
            if role in ['owner', Roles.owner.value, 'administrator', Roles.administrator.value, 'manager', Roles.manager.value]:
                return True
            await EmployerService._ensure_admin_team_table(session)
            row = await session.execute(
                text("SELECT id FROM admin_team_members WHERE owner_id = :oid AND user_id = :uid"),
                {"oid": owner_id, "uid": user_id},
            )
            return row.first() is not None

        @self.router.get("/team-chats/")
        async def list_admin_team_chats(
            authorized: JWT = Depends(employer_authorized),
        ):
            """Список командных чатов профиля Админ PRO и команд, где текущий пользователь участник."""
            from postgres.database import async_session_maker
            from users.models import User
            from sqlalchemy import text

            user_id = int(authorized.id)
            async with async_session_maker() as session:
                await EmployerService._ensure_admin_team_table(session)
                rows = (await session.execute(
                    text("""
                        SELECT owner_id FROM admin_team_members WHERE user_id = :uid
                        UNION
                        SELECT :uid AS owner_id WHERE EXISTS (
                            SELECT 1 FROM admin_team_members WHERE owner_id = :uid
                        )
                    """),
                    {"uid": user_id},
                )).all()

                owner_ids = []
                for row in rows:
                    owner_id = int(row[0] or 0)
                    if owner_id and owner_id not in owner_ids:
                        owner_ids.append(owner_id)

                items = []
                for owner_id in owner_ids:
                    owner = await session.get(User, owner_id)
                    owner_name, owner_role = _display_chat_user(owner)
                    member_count = (await session.execute(
                        text("SELECT COUNT(*) FROM admin_team_members WHERE owner_id = :oid"),
                        {"oid": owner_id},
                    )).scalar() or 0
                    latest = (await session.execute(
                        text("""
                            SELECT message, created_at FROM admin_team_chat_messages
                            WHERE owner_id = :oid
                            ORDER BY created_at DESC
                            LIMIT 1
                        """),
                        {"oid": owner_id},
                    )).first()
                    items.append({
                        "owner_id": owner_id,
                        "title": "Моя команда" if owner_id == user_id else f"Команда: {owner_name}",
                        "owner_name": owner_name,
                        "owner_role": owner_role,
                        "member_count": int(member_count) + 1,
                        "last_message": latest[0] if latest else None,
                        "last_message_at": str(latest[1]) if latest else None,
                    })

                return {"chats": items, "total": len(items)}

        @self.router.get("/team-chat/{owner_id}/")
        async def get_admin_team_chat(
            owner_id: int,
            page_size: int = Query(200, gt=0, le=500),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Сообщения командного чата между админами одной команды."""
            from postgres.database import async_session_maker
            from users.models import User
            from sqlalchemy import text

            async with async_session_maker() as session:
                if not await _can_access_admin_team_chat(session, authorized, owner_id):
                    raise HTTPException(status_code=403, detail="No access to this team chat")

                owner = await session.get(User, owner_id)
                owner_name, owner_role = _display_chat_user(owner)
                member_count = (await session.execute(
                    text("SELECT COUNT(*) FROM admin_team_members WHERE owner_id = :oid"),
                    {"oid": owner_id},
                )).scalar() or 0

                rows = (await session.execute(
                    text("""
                        SELECT id, sender_id, message, created_at
                        FROM admin_team_chat_messages
                        WHERE owner_id = :oid
                        ORDER BY created_at ASC
                        LIMIT :limit
                    """),
                    {"oid": owner_id, "limit": page_size},
                )).all()

                messages = []
                for row in rows:
                    sender = await session.get(User, int(row.sender_id)) if row.sender_id else None
                    sender_name, sender_role = _display_chat_user(sender)
                    messages.append({
                        "id": int(row.id),
                        "sender_id": int(row.sender_id) if row.sender_id else None,
                        "sender_name": sender_name,
                        "sender_role": sender_role,
                        "message": row.message,
                        "created_at": str(row.created_at),
                    })

                return {
                    "team": {
                        "owner_id": owner_id,
                        "title": "Моя команда" if owner_id == int(authorized.id) else f"Команда: {owner_name}",
                        "owner_name": owner_name,
                        "owner_role": owner_role,
                        "member_count": int(member_count) + 1,
                    },
                    "messages": messages,
                }

        @self.router.post("/team-chat/{owner_id}/")
        async def send_admin_team_chat(
            owner_id: int,
            message: str = Query(..., min_length=1, max_length=2000),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Отправить сообщение в командный чат админов."""
            from postgres.database import async_session_maker
            from sqlalchemy import text

            async with async_session_maker() as session:
                if not await _can_access_admin_team_chat(session, authorized, owner_id):
                    raise HTTPException(status_code=403, detail="No access to this team chat")

                msg_id = (await session.execute(
                    text("""
                        INSERT INTO admin_team_chat_messages(owner_id, sender_id, message)
                        VALUES (:oid, :sid, :message)
                        RETURNING id
                    """),
                    {"oid": owner_id, "sid": int(authorized.id), "message": message.strip()},
                )).scalar_one()
                await session.commit()
                return {"ok": True, "message_id": int(msg_id)}

        # ──────────────────────────────────────────────
        # Project Chat (legacy)
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
            profile_ids: Optional[str] = Query(None),
            metro_station: Optional[str] = Query(None),
            city: Optional[str] = Query(None),
            gender: Optional[str] = Query(None),
            look_type: Optional[str] = Query(None),
            hair_color: Optional[str] = Query(None),
            hair_length: Optional[str] = Query(None),
            age_from: Optional[int] = Query(None, ge=0, le=120),
            age_to: Optional[int] = Query(None, ge=0, le=120),
            exp_from: Optional[int] = Query(None, ge=0),
            exp_to: Optional[int] = Query(None, ge=0),
            height_from: Optional[int] = Query(None, ge=0),
            height_to: Optional[int] = Query(None, ge=0),
            clothing_from: Optional[float] = Query(None, ge=0),
            clothing_to: Optional[float] = Query(None, ge=0),
            shoe_from: Optional[float] = Query(None, ge=0),
            shoe_to: Optional[float] = Query(None, ge=0),
            bust_from: Optional[int] = Query(None, ge=0),
            bust_to: Optional[int] = Query(None, ge=0),
            waist_from: Optional[int] = Query(None, ge=0),
            waist_to: Optional[int] = Query(None, ge=0),
            hip_from: Optional[int] = Query(None, ge=0),
            hip_to: Optional[int] = Query(None, ge=0),
            page: int = Query(1, gt=0),
            page_size: int = Query(30, gt=0, le=100),
            authorized: JWT = Depends(employer_authorized),
        ):
            """АдминПРО: просмотр ВСЕХ актёров в базе (не только откликнувшихся)."""
            return await EmployerService.get_all_actors(
                user_token=authorized, page=page, page_size=page_size,
                search=search, profile_ids=profile_ids,
                metro_station=metro_station, city=city, gender=gender,
                look_type=look_type, hair_color=hair_color, hair_length=hair_length,
                age_from=age_from, age_to=age_to, exp_from=exp_from, exp_to=exp_to,
                height_from=height_from, height_to=height_to,
                clothing_from=clothing_from, clothing_to=clothing_to,
                shoe_from=shoe_from, shoe_to=shoe_to,
                bust_from=bust_from, bust_to=bust_to,
                waist_from=waist_from, waist_to=waist_to,
                hip_from=hip_from, hip_to=hip_to,
            )

        @self.router.get("/by-profile/{profile_id}/")
        async def get_actor_by_profile_id(
            profile_id: int,
            authorized: JWT = Depends(employer_authorized),
        ):
            """Получить анкету актёра по Profile.id (для карточки в каст листе)."""
            from postgres.database import async_session_maker
            from profiles.models import Profile, Response
            from castings.models import Casting
            from users.models import ActorProfile, User
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload
            async with async_session_maker() as session:
                p = await session.get(Profile, profile_id)
                if not p:
                    raise HTTPException(status_code=404, detail="Profile not found")

                can_view_full_profile = await EmployerService._has_any_team_access(session, authorized)
                if not can_view_full_profile:
                    response_rows = (await session.execute(
                        select(Response.casting_id)
                        .where(Response.profile_id == profile_id)
                        .order_by(Response.created_at.desc())
                        .limit(50)
                    )).all()
                    for row in response_rows:
                        casting = await session.get(Casting, int(row[0]))
                        if casting and await EmployerService._has_team_access(session, authorized, casting):
                            can_view_full_profile = True
                            break

                if not can_view_full_profile:
                    raise HTTPException(status_code=403, detail="No access to this actor profile")

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
                uploaded_video = None
                uploaded_video_poster = None
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
                        elif m.file_type == 'video' and uploaded_video is None:
                            uploaded_video = m.processed_url or m.original_url
                            uploaded_video_poster = m.thumbnail_url

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
                    "metro_station": ap.metro_station if ap else None,
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
                    "video_intro": uploaded_video
                        or (ap.video_intro if ap else None)
                        or getattr(p, 'video_intro', None),
                    "video_poster": uploaded_video_poster,
                    "phone_number": ap.phone_number if ap else p.phone_number,
                    "email": ap.email if ap else p.email,
                    # Соцсети актёра/агента (из аккаунта пользователя). Для
                    # агентских анкет owner_user — это агент, что и нужно.
                    "telegram_nick": getattr(owner_user, 'telegram_nick', None) if owner_user else None,
                    "vk_nick": getattr(owner_user, 'vk_nick', None) if owner_user else None,
                    "max_nick": getattr(owner_user, 'max_nick', None) if owner_user else None,
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

        async def _resolve_favorites_user_id(session, authorized: JWT, team_owner_id: Optional[int]) -> int:
            if not team_owner_id:
                return int(authorized.id)
            return await EmployerService._resolve_owner_scope(session, authorized, team_owner_id)

        @self.router.get("/")
        async def list_favorites(
            team_owner_id: Optional[int] = Query(None, description="ID владельца команды из раздела Где я работаю"),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Список избранных актёров текущего пользователя."""
            from postgres.database import async_session_maker as async_session
            from profiles.models import Profile
            from users.models import EmployerFavorite
            from users.models import ActorProfile
            from sqlalchemy import select
            try:
                await _ensure_table()
            except Exception:
                pass
            async with async_session() as session:
                user_id = await _resolve_favorites_user_id(session, authorized, team_owner_id)
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
                        "metro_station": ap.metro_station if ap else None,
                        "age": age,
                        "photo_url": ap_photo or photo,
                        "media_assets": media_assets,
                    })

                return {"favorites": items, "profile_ids": profile_ids}

        @self.router.post("/toggle/")
        async def toggle_favorite(
            profile_id: int = Query(...),
            team_owner_id: Optional[int] = Query(None, description="ID владельца команды из раздела Где я работаю"),
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
                    user_id = await _resolve_favorites_user_id(session, authorized, team_owner_id)
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
            team_owner_id: Optional[int] = Query(None, description="ID владельца команды из раздела Где я работаю"),
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
                user_id = await _resolve_favorites_user_id(session, authorized, team_owner_id)
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
    """Роуты для Employer/EmployerPro — работа с каст листами и шорт-листами."""

    def __init__(self):
        self.router = APIRouter(tags=["employer-reports"], prefix="/reports")
        self._include()

    def _include(self):
        @self.router.get("/")
        async def get_my_reports(
            page: int = Query(1, gt=0),
            page_size: int = Query(20, gt=0),
            team_owner_id: Optional[int] = Query(None, description="ID владельца команды из раздела Где я работаю"),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Список каст листов (шорт-листов) работодателя с агрегированной
            статистикой и названием кастинга/проекта."""
            from postgres.database import async_session_maker
            from reports.models import Report, ProfilesReports
            from castings.models import Casting, CastingImage, ProjectCollaborator
            from profiles.models import Response
            from sqlalchemy import select, func, case, literal, and_, exists, or_
            async with async_session_maker() as session:
                user_id = int(authorized.id)
                role = authorized.role
                owner_scope_id = await EmployerService._resolve_owner_scope(session, authorized, team_owner_id)

                base = select(Report).join(Casting, Report.casting_id == Casting.id)
                if team_owner_id:
                    owner_project_ids_q = select(Casting.id).where(
                        Casting.owner_id == owner_scope_id,
                        Casting.parent_project_id == None,
                    )
                    base = base.where(
                        or_(
                            Casting.owner_id == owner_scope_id,
                            Casting.parent_project_id.in_(owner_project_ids_q),
                        )
                    )
                elif role not in ['owner', 'administrator', 'manager']:
                    collab_ids_q = select(ProjectCollaborator.casting_id).where(ProjectCollaborator.user_id == user_id)
                    collab_child_ids_q = select(Casting.id).where(Casting.parent_project_id.in_(collab_ids_q))
                    base = base.where(
                        or_(
                            Casting.owner_id == user_id,
                            Casting.id.in_(collab_ids_q),
                            Casting.parent_project_id.in_(collab_ids_q),
                            Casting.id.in_(collab_child_ids_q),
                        )
                    )

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

                # Счётчики: всего актёров в каст листе и из них откликавшихся на кастинг
                report_ids = [r.id for r in reports]
                counts: dict[int, dict] = {rid: {"total": 0, "via": 0} for rid in report_ids}
                if report_ids:
                    # total: сколько актёров в каждом каст листе
                    t_res = await session.execute(
                        select(ProfilesReports.report_id, func.count(ProfilesReports.profile_id))
                        .where(ProfilesReports.report_id.in_(report_ids))
                        .group_by(ProfilesReports.report_id)
                    )
                    for rid, cnt in t_res.all():
                        counts[rid]["total"] = int(cnt or 0)

                    # via: сколько из них реально откликались на кастинг каст листа
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
            """Создать каст лист (шорт-лист) для кастинга."""
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
                    if not await EmployerService._has_team_access(session, authorized, casting):
                        raise HTTPException(status_code=403, detail="Not your team casting")

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
                        title="Каст лист сформирован",
                        message=f"📋 {actor_name} сформировал каст лист «{report.title}» по кастингу «{casting.title}».",
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
            actor_profile_ids: Optional[list[int]] = Query(None),
            authorized: JWT = Depends(employer_authorized),
        ):
            """
            Добавить актёров в шорт-лист.
            AdminPro: может добавить ЛЮБОГО актёра (откликнувшегося и нет).
            Admin: только откликнувшихся на свой кастинг.
            """
            from postgres.database import async_session_maker
            from reports.models import Report, ProfilesReports
            from profiles.models import Profile, Response
            from users.models import ActorProfile
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
                    if not casting or not await EmployerService._has_team_access(session, authorized, casting):
                        raise HTTPException(status_code=403, detail="Not your team report")

                is_pro = role in ['employer_pro', 'owner', 'administrator', 'manager'] or await EmployerService._has_any_team_access(session, authorized)

                added = 0
                already_exists = 0
                skipped = 0
                for idx, pid in enumerate(profile_ids):
                    requested_actor_profile_id = None
                    if actor_profile_ids and idx < len(actor_profile_ids):
                        requested_actor_profile_id = actor_profile_ids[idx] or None

                    # Для агентских актёров фронт передаёт и legacy profile_id,
                    # и конкретный actor_profile_id. Если profile_id пришёл не
                    # legacy (или устарел), восстанавливаем его по владельцу анкеты.
                    if requested_actor_profile_id:
                        ap = await session.get(ActorProfile, requested_actor_profile_id)
                        if not ap or ap.is_deleted:
                            skipped += 1
                            continue
                        profile_res = await session.execute(
                            select(Profile).where(Profile.user_id == ap.user_id)
                        )
                        profile = profile_res.unique().scalar_one_or_none()
                        if not profile:
                            profile = Profile(
                                user_id=ap.user_id,
                                first_name=ap.first_name,
                                last_name=ap.last_name,
                                about_me=ap.about_me,
                                video_intro=ap.video_intro,
                            )
                            session.add(profile)
                            await session.flush()
                        pid = profile.id

                    if not is_pro:
                        resp = await session.execute(
                            select(Response).where(
                                and_(
                                    Response.casting_id == report.casting_id,
                                    (
                                        Response.actor_profile_id == requested_actor_profile_id
                                        if requested_actor_profile_id
                                        else Response.profile_id == pid
                                    ),
                                )
                            )
                        )
                        if not resp.scalar_one_or_none():
                            skipped += 1
                            continue

                    existing_conditions = [
                        ProfilesReports.profile_id == pid,
                        ProfilesReports.report_id == report_id,
                    ]
                    if requested_actor_profile_id:
                        existing_conditions.append(
                            ProfilesReports.actor_profile_id == requested_actor_profile_id
                        )
                    else:
                        existing_conditions.append(ProfilesReports.actor_profile_id == None)  # noqa: E711
                    existing = await session.execute(
                        select(ProfilesReports).where(
                            and_(*existing_conditions)
                        )
                    )
                    if existing.scalar_one_or_none():
                        already_exists += 1
                        continue

                    link = ProfilesReports(
                        profile_id=pid,
                        actor_profile_id=requested_actor_profile_id,
                        report_id=report_id,
                    )
                    session.add(link)
                    added += 1

                    try:
                        actor_profile = await session.get(Profile, pid)
                        if actor_profile and actor_profile.user_id:
                            await NotificationService.create(
                                user_id=actor_profile.user_id,
                                type=NotificationType.SYSTEM,
                                title="Вы в избранном",
                                message=f"📋 Вас добавили в каст лист «{report.title}» для кастинга «{casting.title if casting else '—'}».",
                            )
                    except Exception:
                        pass

                await session.commit()
                return {
                    "added": added,
                    "already_exists": already_exists,
                    "skipped": skipped,
                    "report_id": report_id,
                }

        @self.router.delete("/{report_id}/remove-actors/")
        async def remove_actors_from_report(
            report_id: int,
            profile_ids: list[int] = Query(...),
            actor_profile_ids: Optional[list[int]] = Query(None),
            authorized: JWT = Depends(employer_authorized),
        ):
            from postgres.database import async_session_maker
            from reports.models import Report, ProfilesReports
            from castings.models import Casting
            from sqlalchemy import select, and_, delete
            async with async_session_maker() as session:
                report = await session.get(Report, report_id)
                if not report:
                    raise HTTPException(status_code=404, detail="Report not found")

                casting = await session.get(Casting, report.casting_id)
                role = authorized.role
                user_id = int(authorized.id)

                if role not in ['owner', 'administrator', 'manager']:
                    if not casting or not await EmployerService._has_team_access(session, authorized, casting):
                        raise HTTPException(status_code=403, detail="Not your team report")

                deleted = 0
                if actor_profile_ids:
                    for idx, pid in enumerate(profile_ids):
                        apid = actor_profile_ids[idx] if idx < len(actor_profile_ids) else None
                        conditions = [
                            ProfilesReports.report_id == report_id,
                            ProfilesReports.profile_id == pid,
                        ]
                        if apid:
                            conditions.append(ProfilesReports.actor_profile_id == apid)
                        else:
                            conditions.append(ProfilesReports.actor_profile_id == None)  # noqa: E711
                        res = await session.execute(
                            delete(ProfilesReports).where(and_(*conditions))
                        )
                        deleted += int(res.rowcount or 0)
                else:
                    res = await session.execute(
                        delete(ProfilesReports).where(
                            and_(
                                ProfilesReports.report_id == report_id,
                                ProfilesReports.profile_id.in_(profile_ids),
                            )
                        )
                    )
                    deleted = int(res.rowcount or 0)
                await session.commit()
                return {"removed": deleted, "report_id": report_id}

        @self.router.patch("/{report_id}/")
        async def rename_report(
            report_id: int,
            title: str = Query(..., min_length=1, max_length=120),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Переименовать каст лист.

            Название — рабочая подпись документа, который уходит заказчику,
            поэтому менять его нужно и после создания: кастинг переименовали,
            добавили дату или номер тура.
            """
            from postgres.database import async_session_maker
            from reports.models import Report
            from castings.models import Casting

            new_title = (title or '').strip()
            if not new_title:
                raise HTTPException(status_code=400, detail="Название не может быть пустым")

            async with async_session_maker() as session:
                report = await session.get(Report, report_id)
                if not report:
                    raise HTTPException(status_code=404, detail="Report not found")

                casting = await session.get(Casting, report.casting_id)
                if authorized.role not in ['owner', 'administrator', 'manager']:
                    if not casting or not await EmployerService._has_team_access(session, authorized, casting):
                        raise HTTPException(status_code=403, detail="Not your team report")

                report.title = new_title
                await session.commit()

                return {"id": report_id, "title": new_title}

        @self.router.get("/{report_id}/export/pdf/")
        async def export_report_pdf(
            report_id: int,
            request: Request,
            status: Optional[str] = Query(
                None,
                description="all | new | accepted | reserve (можно через запятую)",
            ),
            authorized: JWT = Depends(employer_authorized),
        ) -> Response:
            """Скачать каст лист в PDF из кабинета — тот же файл, что по ссылке.

            Доступ проверяется по команде проекта: заказчик выгружает только
            свои каст листы.
            """
            from postgres.database import async_session_maker
            from reports.models import Report
            from castings.models import Casting
            from shortlists.routes import build_cast_list_pdf_response

            async with async_session_maker() as session:
                report = await session.get(Report, report_id)
                if not report:
                    raise HTTPException(status_code=404, detail="Report not found")

                casting = await session.get(Casting, report.casting_id)
                if authorized.role not in ['owner', 'administrator', 'manager']:
                    if not casting or not await EmployerService._has_team_access(session, authorized, casting):
                        raise HTTPException(status_code=403, detail="Not your team report")

            return await build_cast_list_pdf_response(
                request, report_id=report_id, status_param=status,
            )

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
                    if not casting or not await EmployerService._has_team_access(session, authorized, casting):
                        raise HTTPException(status_code=403, detail="Not your team report")

                result = await session.execute(
                    select(ProfilesReports)
                    .options(joinedload(ProfilesReports.profile))
                    .where(ProfilesReports.report_id == report_id)
                )
                links = result.scalars().unique().all()

                from users.models import ActorProfile, User
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

                    ap_filters = [
                        ActorProfile.user_id == p.user_id,
                        ActorProfile.is_deleted == False,
                    ]
                    if getattr(link, "actor_profile_id", None):
                        ap_filters.append(ActorProfile.id == link.actor_profile_id)
                    ap_result = await session.execute(
                        select(ActorProfile).where(*ap_filters).order_by(ActorProfile.created_at.desc()).limit(1)
                    )
                    ap = ap_result.unique().scalar_one_or_none()
                    owner_user = await session.get(User, p.user_id) if p.user_id else None
                    owner_role = (
                        owner_user.role.value if owner_user and hasattr(owner_user.role, 'value')
                        else str(owner_user.role) if owner_user and owner_user.role else None
                    )
                    has_agent = owner_role == 'agent'
                    if has_agent and owner_user:
                        agent_parts = [x for x in [owner_user.first_name, owner_user.last_name] if x]
                        contact_phone = owner_user.phone_number
                        contact_email = owner_user.email
                        agent_name = " ".join(agent_parts) if agent_parts else (owner_user.email or "Агент")
                    else:
                        contact_phone = (ap.phone_number if ap else None) or p.phone_number
                        contact_email = (ap.email if ap else None) or p.email
                        agent_name = None

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
                        "actor_profile_id": getattr(link, "actor_profile_id", None) or (ap.id if ap else None),
                        "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                        "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                        "display_name": ap.display_name if ap else None,
                        "gender": p.gender.value if hasattr(p.gender, 'value') else str(p.gender) if p.gender else (ap.gender if ap else None),
                        "age": age,
                        "city": (ap.city if ap and ap.city else None) or (str(p.city_full) if p.city_full else None),
                        "metro_station": ap.metro_station if ap else None,
                        "height": ap.height if ap else (float(p.height) if p.height else None),
                        "clothing_size": (ap.clothing_size if ap else None) or (str(p.clothing_size) if p.clothing_size else None),
                        "shoe_size": (ap.shoe_size if ap else None) or (str(p.shoe_size) if p.shoe_size else None),
                        "look_type": ap.look_type if ap else None,
                        "hair_color": ap.hair_color if ap else None,
                        "hair_length": ap.hair_length if ap else None,
                        "bust_volume": ap.bust_volume if ap else (float(p.bust_volume) if p.bust_volume else None),
                        "waist_volume": ap.waist_volume if ap else (float(p.waist_volume) if p.waist_volume else None),
                        "hip_volume": ap.hip_volume if ap else (float(p.hip_volume) if p.hip_volume else None),
                        "experience": ap.experience if ap else p.experience,
                        "phone_number": contact_phone,
                        "email": contact_email,
                        "telegram_nick": getattr(owner_user, 'telegram_nick', None) if owner_user else None,
                        "vk_nick": getattr(owner_user, 'vk_nick', None) if owner_user else None,
                        "max_nick": getattr(owner_user, 'max_nick', None) if owner_user else None,
                        "has_agent": has_agent,
                        "agent_name": agent_name,
                        "photo_url": ap_photo or ap_photo_fallback or photo,
                        "media_assets": media_assets,
                        "favorite": link.favorite,
                        "review_status": getattr(link, "review_status", None) or "new",
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
            page_size: int = Query(20, gt=0, le=100),
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
                    actor_profile_id=data.actor_profile_id,
                    self_test_url=data.self_test_url,
                )
            except HTTPException:
                raise
            except Exception:
                logger.exception("respond_to_casting failed")
                raise HTTPException(status_code=500, detail="Не удалось отправить отклик")

        @self.router.post("/agent-respond/")
        async def agent_respond_to_casting(
            data: SAgentBulkResponseCreate,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Агент откликает нескольких своих актёров на кастинг."""
            if authorized.role not in [Roles.agent.value, 'agent']:
                raise HTTPException(status_code=403, detail="Только агент может откликать актёров")
            try:
                return await ActorFeedService.agent_respond_to_casting(
                    user_token=authorized,
                    casting_id=data.casting_id,
                    profile_ids=data.profile_ids,
                )
            except HTTPException:
                raise
            except Exception as e:
                import traceback
                tb = traceback.format_exc()
                logger.error("agent_respond_to_casting failed: %s\n%s", e, tb)
                raise HTTPException(
                    status_code=500,
                    detail=f"{e.__class__.__name__}: {e}",
                )

        @self.router.delete("/responses/{response_id}/")
        async def cancel_response(
            response_id: int,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Отменить свой отклик по его id (страница «Мои отклики»)."""
            return await ActorFeedService.cancel_response(
                user_token=authorized, response_id=response_id
            )

        @self.router.delete("/castings/{casting_id}/response/")
        async def cancel_response_by_casting(
            casting_id: int,
            actor_profile_id: Optional[int] = Query(None, gt=0),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Отменить свой отклик на кастинг (лента и карточка кастинга).

            В ленте id отклика не известен — там есть только кастинг, поэтому
            отклик находим по нему (и по анкете, если у агента их несколько).
            """
            return await ActorFeedService.cancel_response(
                user_token=authorized,
                casting_id=casting_id,
                actor_profile_id=actor_profile_id,
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
            """Статус рассмотрения актёра: на рассмотрении / в избранном / утвержден."""
            from postgres.database import async_session_maker
            from reports.models import ProfilesReports
            from castings.models import Casting
            from sqlalchemy import select
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

                items = []
                for pr in entries:
                    report = pr.report
                    casting = await session.get(Casting, report.casting_id) if report else None
                    actor_status, actor_status_label = ActorFeedService._resolve_actor_response_status(
                        'pending',
                        [pr],
                    )

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
            casting_id: Optional[int] = Query(None, gt=0),
        ):
            """Публичный профиль админа/работодателя.

            Здесь только публичные поля, поэтому endpoint не зависит от access
            token. Актёр может открыть автора из ленты даже во время обновления
            сессии или из публичной страницы кастинга.
            """
            from postgres.database import async_session_maker
            from users.models import User
            from castings.models import Casting
            from castings.enums import CastingStatusEnum
            from sqlalchemy import and_, func, or_, select

            async with async_session_maker() as session:
                # При переходе именно из карточки кастинга определяем автора по
                # самому кастингу. Это источник истины для старых записей, где
                # переданный фронтом published_by_id мог отсутствовать или быть
                # устаревшим; owner_id остаётся совместимым fallback.
                resolved_user_id = user_id
                if casting_id is not None:
                    source_casting = await session.get(Casting, casting_id)
                    if not source_casting:
                        raise HTTPException(status_code=404, detail="Кастинг не найден")
                    resolved_user_id = (
                        getattr(source_casting, "published_by_id", None)
                        or getattr(source_casting, "owner_id", None)
                        or user_id
                    )

                user = await session.get(User, resolved_user_id)
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
                role_val = (
                    user.role.value
                    if user.role is not None and hasattr(user.role, "value")
                    else str(user.role or "employer")
                )
                role_label = role_labels.get(role_val, role_val)

                authored_by_user = or_(
                    Casting.published_by_id == resolved_user_id,
                    and_(
                        Casting.published_by_id.is_(None),
                        Casting.owner_id == resolved_user_id,
                    ),
                )

                published_count = 0
                total_count = 0
                casting_items = []
                try:
                    published_count_result = await session.execute(
                        select(func.count(Casting.id)).where(
                            authored_by_user,
                            Casting.status == CastingStatusEnum.published,
                        )
                    )
                    published_count = published_count_result.scalar() or 0

                    total_count_result = await session.execute(
                        select(func.count(Casting.id)).where(authored_by_user)
                    )
                    total_count = total_count_result.scalar() or 0

                    castings_result = await session.execute(
                        select(Casting)
                        .where(authored_by_user, Casting.status == CastingStatusEnum.published)
                        .order_by(Casting.created_at.desc())
                        .limit(10)
                    )
                    recent_castings = castings_result.unique().scalars().all()
                    for c in recent_castings:
                        try:
                            image_url = await EmployerService._get_casting_image_url(
                                session, c.id, casting=c
                            )
                        except Exception:
                            logger.exception(
                                "Failed to load image for public admin profile casting %s",
                                c.id,
                            )
                            image_url = None
                        casting_items.append({
                            "id": c.id,
                            "title": c.title,
                            "description": (c.description or "")[:150],
                            "image_url": image_url,
                            "created_at": str(c.created_at) if c.created_at else None,
                        })
                except Exception:
                    # Профиль администратора важнее необязательной статистики:
                    # при ошибке агрегации всё равно возвращаем имя, роль и фото.
                    logger.exception(
                        "Failed to load public admin profile statistics for user %s",
                        resolved_user_id,
                    )

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
            """Активировать подписку и получить новый токен с обновлённой ролью.

            Унифицировано с /billing/subscribe/ — обе ручки ведут в один и тот же
            биллинг-модуль (billing.service.BillingService) и одну таблицу подписок.
            """
            from billing.service import BillingService
            from users.services.auth_token.service import TokenService

            result = await BillingService.subscribe(
                user_id=int(authorized.id), plan_code=plan, days=days
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
            """Текущая подписка пользователя (см. примечание к /activate/ выше)."""
            from billing.service import BillingService
            sub = await BillingService.get_user_subscription(user_id=int(authorized.id))
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
        async def _ensure_superadmin_ticket_reads_table(session) -> None:
            from sqlalchemy import text

            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS superadmin_ticket_reads (
                    admin_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    ticket_id INTEGER NOT NULL REFERENCES verification_tickets(id) ON DELETE CASCADE,
                    last_read_message_id INTEGER NOT NULL DEFAULT 0,
                    read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    PRIMARY KEY (admin_id, ticket_id)
                )
            """))
            await session.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_superadmin_ticket_reads_admin ON superadmin_ticket_reads(admin_id)"
            ))
            await session.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_superadmin_ticket_reads_ticket ON superadmin_ticket_reads(ticket_id)"
            ))

        async def _get_unread_ticket_count(session, admin_id: int) -> int:
            from sqlalchemy import text

            tbl = await session.execute(text("SELECT to_regclass('public.verification_tickets')"))
            if tbl.scalar() is None:
                return 0
            msg_tbl = await session.execute(text("SELECT to_regclass('public.ticket_messages')"))
            if msg_tbl.scalar() is None:
                return 0

            await _ensure_superadmin_ticket_reads_table(session)
            count = (await session.execute(
                text("""
                    SELECT COUNT(*)
                    FROM verification_tickets t
                    JOIN LATERAL (
                        SELECT id, sender_id
                        FROM ticket_messages
                        WHERE ticket_id = t.id
                        ORDER BY id DESC
                        LIMIT 1
                    ) lm ON TRUE
                    LEFT JOIN superadmin_ticket_reads r
                        ON r.ticket_id = t.id AND r.admin_id = :admin_id
                    WHERE t.status = 'open'
                        AND COALESCE(lm.sender_id, 0) != :admin_id
                        AND COALESCE(r.last_read_message_id, 0) < lm.id
                """),
                {"admin_id": int(admin_id)},
            )).scalar()
            return int(count or 0)

        async def _mark_ticket_read(session, admin_id: int, ticket_id: int) -> int:
            from sqlalchemy import text

            await _ensure_superadmin_ticket_reads_table(session)
            last_message_id = (await session.execute(
                text("""
                    SELECT id
                    FROM ticket_messages
                    WHERE ticket_id = :ticket_id
                    ORDER BY id DESC
                    LIMIT 1
                """),
                {"ticket_id": int(ticket_id)},
            )).scalar()
            await session.execute(
                text("""
                    INSERT INTO superadmin_ticket_reads(admin_id, ticket_id, last_read_message_id, read_at)
                    VALUES (:admin_id, :ticket_id, :last_read_message_id, now())
                    ON CONFLICT (admin_id, ticket_id)
                    DO UPDATE SET
                        last_read_message_id = EXCLUDED.last_read_message_id,
                        read_at = now()
                """),
                {
                    "admin_id": int(admin_id),
                    "ticket_id": int(ticket_id),
                    "last_read_message_id": int(last_message_id or 0),
                },
            )
            return int(last_message_id or 0)

        @self.router.get("/telegram-channel/status/")
        async def telegram_channel_status(
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: диагностика публикации кастингов в Telegram-канал.

            Отвечает на вопрос «почему кастинг не появился в канале»: задан ли
            канал, видит ли его бот, есть ли право публикации и какая ссылка
            уйдёт в кнопку «Откликнуться»."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin can view channel status")

            from postgres.database import async_session_maker
            from castings.services.shared.telegram_sync import CastingTelegramSyncService

            async with async_session_maker() as session:
                return await CastingTelegramSyncService.diagnose(session)

        @self.router.post("/castings/{casting_id}/telegram-resync/")
        async def telegram_resync_casting(
            casting_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: переотправить пост кастинга в канал заново.

            Нужен, когда пост не ушёл (канал был не настроен) или ушёл в
            неправильном виде — удаляет старое сообщение и публикует заново."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin can resync channel posts")

            from postgres.database import async_session_maker
            from castings.models import Casting
            from castings.enums import CastingStatusEnum
            from castings.services.shared.telegram_sync import CastingTelegramSyncService

            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Кастинг не найден")
                if casting.status != CastingStatusEnum.published:
                    raise HTTPException(
                        status_code=400,
                        detail="В канал отправляются только опубликованные кастинги.",
                    )

                post = await CastingTelegramSyncService.resync(session, casting_id)
                if not post:
                    error = CastingTelegramSyncService.last_error
                    detail = "Не удалось отправить пост в канал."
                    if not CastingTelegramSyncService.is_configured():
                        detail = (
                            "Публикация в канал не настроена: не задан TG_CHANEL_NAME "
                            "или TG_BOT_TOKEN."
                        )
                    elif error:
                        detail = f"Не удалось отправить пост в канал: {error}"
                    raise HTTPException(status_code=502, detail=detail)

                return {
                    "casting_id": casting_id,
                    "post_url": post.post_url,
                    "message_id": post.message_id,
                }

        @self.router.delete("/profiles/{profile_id}/")
        async def delete_any_profile(
            profile_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: полностью удалить любую анкету актёра."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin can delete any profile")

            from postgres.database import async_session_maker
            from users.models import ActorProfile
            from profiles.models import Profile
            async with async_session_maker() as session:
                actor_profile = await session.get(ActorProfile, profile_id)
                if actor_profile:
                    # SuperAdmin может удалять чужие анкеты, но не свою собственную.
                    if getattr(actor_profile, 'user_id', None) == int(authorized.id):
                        raise HTTPException(status_code=403, detail="Нельзя удалить собственную анкету")
                    await session.delete(actor_profile)
                    await session.commit()
                    return {"deleted": profile_id, "type": "actor_profile"}

                profile = await session.get(Profile, profile_id)
                if not profile:
                    raise HTTPException(status_code=404, detail="Profile not found")
                if getattr(profile, 'user_id', None) == int(authorized.id):
                    raise HTTPException(status_code=403, detail="Нельзя удалить собственную анкету")
                await session.delete(profile)
                await session.commit()
            return {"deleted": profile_id, "type": "legacy_profile"}

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
            from castings.services.shared.telegram_sync import CastingTelegramSyncService
            async with async_session_maker() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Casting not found")
                # Снимаем пост из Telegram-канала перед удалением, чтобы не оставлять
                # «осиротевший» пост на удалённый кастинг.
                try:
                    await CastingTelegramSyncService.unpublish(session, casting.id, commit=False)
                except Exception as exc:
                    logger.warning("Telegram channel cleanup on superadmin delete failed for casting %s: %s", casting_id, exc)
                # reports.casting_id не имеет ON DELETE CASCADE — чистим вручную,
                # иначе удаление кастинга с откликами/в каст листе падает по FK.
                await EmployerService.purge_casting_reports(session, casting.id)
                await session.delete(casting)
                await session.commit()
            return {"deleted": casting_id}

        @self.router.delete("/users/{user_id}/")
        async def delete_any_user(
            user_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: полностью удалить аккаунт клиента.

            Жёсткое удаление: строка пользователя и все связанные данные
            (анкеты, фото, отклики, подписки, уведомления и т.д.) удаляются
            каскадом на уровне БД. Принадлежащие пользователю кастинги удаляются
            явно (FK у них SET NULL), их посты снимаются из Telegram-канала.
            Email, телефон и Telegram освобождаются — данные можно переиспользовать.
            """
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin can delete users")

            if user_id == int(authorized.id):
                raise HTTPException(status_code=403, detail="Нельзя удалить собственный аккаунт")

            from postgres.database import async_session_maker
            from sqlalchemy import select, delete as sa_delete, text
            from users.models import User
            from castings.models import Casting
            from castings.services.shared.telegram_sync import CastingTelegramSyncService

            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")
                # Защита: владельцев платформы удалять нельзя.
                user_role_value = getattr(user.role, 'value', user.role)
                if user_role_value == 'owner':
                    raise HTTPException(status_code=403, detail="Нельзя удалить аккаунт владельца")

                async def _table_exists(table_name: str) -> bool:
                    exists = await session.scalar(
                        text("SELECT to_regclass(:table_name)"),
                        {"table_name": f"public.{table_name}"},
                    )
                    return bool(exists)

                async def _execute_if_exists(table_name: str, statement: str, params: dict) -> None:
                    if await _table_exists(table_name):
                        await session.execute(text(statement), params)

                await _execute_if_exists(
                    "project_collaborators",
                    "DELETE FROM project_collaborators WHERE user_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "admin_team_members",
                    "DELETE FROM admin_team_members WHERE owner_id = :uid OR user_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "admin_team_chat_messages",
                    "DELETE FROM admin_team_chat_messages WHERE owner_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "admin_team_chat_messages",
                    "UPDATE admin_team_chat_messages SET sender_id = NULL WHERE sender_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "ticket_messages",
                    "UPDATE ticket_messages SET sender_id = NULL WHERE sender_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "general_chat_messages",
                    "UPDATE general_chat_messages SET sender_id = NULL WHERE sender_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "project_chat_messages",
                    "UPDATE project_chat_messages SET sender_id = NULL WHERE sender_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "action_logs",
                    "UPDATE action_logs SET user_id = NULL WHERE user_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "blacklist",
                    "UPDATE blacklist SET banned_by = NULL WHERE banned_by = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "shortlist_tokens",
                    "UPDATE shortlist_tokens SET created_by = NULL WHERE created_by = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "superadmin_ticket_reads",
                    "DELETE FROM superadmin_ticket_reads WHERE admin_id = :uid",
                    {"uid": user_id},
                )
                await _execute_if_exists(
                    "castings",
                    "UPDATE castings SET published_by_id = NULL WHERE published_by_id = :uid",
                    {"uid": user_id},
                )

                own_castings = (await session.execute(
                    select(Casting).where(Casting.owner_id == user_id)
                )).unique().scalars().all()
                for casting in own_castings:
                    try:
                        await CastingTelegramSyncService.unpublish(session, casting.id, commit=False)
                    except Exception as exc:
                        logger.warning(
                            "Telegram channel cleanup on user delete failed for casting %s: %s",
                            casting.id, exc,
                        )
                    await EmployerService.purge_casting_reports(session, casting.id)
                    await session.delete(casting)

                await session.execute(sa_delete(User).where(User.id == user_id))
                await session.commit()

            return {"deleted": user_id, "type": "user"}

        @self.router.delete("/demo-data/")
        async def delete_demo_data(
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: удалить аккаунты, созданные демо-сидером."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin can delete demo data")

            demo_emails = [
                "admin1@demo.ru",
                "admin2@demo.ru",
                "admin3@demo.ru",
                "admin4@demo.ru",
                "agent1@demo.ru",
                "agent2@demo.ru",
                "actress1@demo.ru",
                "actress2@demo.ru",
                "actor3@demo.ru",
            ]

            from postgres.database import async_session_maker
            from sqlalchemy import func, select
            from users.models import User

            async with async_session_maker() as session:
                rows = (await session.execute(
                    select(User.id, User.email)
                    .where(func.lower(User.email).in_(demo_emails))
                    .order_by(User.id.asc())
                )).all()

            deleted = []
            errors = []
            for uid, email in rows:
                try:
                    await delete_any_user(int(uid), authorized)
                    deleted.append({"id": int(uid), "email": email})
                except HTTPException as exc:
                    errors.append({"id": int(uid), "email": email, "error": exc.detail})
                except Exception as exc:
                    logger.exception("Demo account cleanup failed for user %s", uid)
                    errors.append({"id": int(uid), "email": email, "error": str(exc)})

            return {
                "ok": len(errors) == 0,
                "message": f"Удалено демо-аккаунтов: {len(deleted)}",
                "deleted": deleted,
                "errors": errors,
            }

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
                    "city": profile.city, "metro_station": profile.metro_station, "tax_status": profile.tax_status,
                    "qualification": profile.qualification,
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
                    'phone_number', 'email', 'city', 'metro_station', 'tax_status', 'qualification', 'experience', 'about_me',
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
                    "city": profile.city, "metro_station": profile.metro_station, "tax_status": profile.tax_status,
                    "qualification": profile.qualification,
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
            from users.models import User
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

        @self.router.get("/castings/")
        async def list_all_castings(
            page: int = Query(1, gt=0),
            page_size: int = Query(300, gt=0),
            search: str = Query("", description="Поиск по названию"),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: быстрый плоский список всех реальных кастингов.

            В отличие от /projects/ не возвращает служебные контейнеры и не
            требует на фронте делать N дополнительных запросов по проектам.
            """
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from castings.models import Casting
            from profiles.models import Response
            from users.models import User
            from sqlalchemy import select, func, or_

            async with async_session_maker() as session:
                container_ids = (
                    select(Casting.parent_project_id)
                    .where(Casting.parent_project_id != None)
                    .distinct()
                )
                real_casting_filter = or_(
                    Casting.parent_project_id != None,
                    ~Casting.id.in_(container_ids),
                )

                base = select(Casting.id).where(real_casting_filter)
                if search.strip():
                    base = base.where(Casting.title.ilike(f"%{search.strip()}%"))

                total = (await session.execute(
                    select(func.count()).select_from(base.subquery())
                )).scalar() or 0

                response_counts = (
                    select(
                        Response.casting_id.label("casting_id"),
                        func.count(Response.id).label("response_count"),
                    )
                    .group_by(Response.casting_id)
                    .subquery()
                )

                query = (
                    select(
                        Casting,
                        User,
                        func.coalesce(response_counts.c.response_count, 0).label("response_count"),
                    )
                    .outerjoin(User, User.id == Casting.owner_id)
                    .outerjoin(response_counts, response_counts.c.casting_id == Casting.id)
                    .where(real_casting_filter)
                    .order_by(Casting.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
                if search.strip():
                    query = query.where(Casting.title.ilike(f"%{search.strip()}%"))

                rows = (await session.execute(query)).unique().all()
                castings = []
                for c, owner, response_count in rows:
                    owner_name = None
                    if owner:
                        parts = [p for p in [owner.first_name, owner.last_name] if p]
                        owner_name = " ".join(parts) if parts else (owner.email or f"user#{owner.id}")

                    image_url = next((img.photo_url for img in (c.image or []) if getattr(img, "photo_url", None)), None)
                    published_at = c.post.published_at if c.post and c.post.published_at else None

                    castings.append({
                        "id": c.id,
                        "title": c.title,
                        "description": c.description,
                        "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                        "response_count": int(response_count or 0),
                        "created_at": str(c.created_at),
                        "updated_at": str(c.updated_at) if c.updated_at else None,
                        "published_at": published_at,
                        "image_url": image_url,
                        "owner_id": getattr(c, 'owner_id', None) or 0,
                        "owner_name": owner_name,
                        "parent_project_id": c.parent_project_id,
                        "city": c.city,
                        "project_category": c.project_category,
                        "role_types": c.role_types,
                        "gender": c.gender,
                        "age_from": c.age_from,
                        "age_to": c.age_to,
                        "financial_conditions": c.financial_conditions,
                        "shooting_dates": c.shooting_dates,
                    })

                return {"castings": castings, "total": total}

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
            from users.models import User
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
            from users.models import User, ActorProfile, MediaAsset
            from castings.models import Casting
            from actor_profiles.service import REQUIRED_PHOTO_CATEGORIES
            from sqlalchemy import select, func
            async with async_session_maker() as session:
                # Удалённые аккаунты не считаем: разбивка по ролям ниже их уже
                # исключала, из-за чего «Пользователей» не сходилось с суммой
                # по ролям.
                users_total = (await session.execute(
                    select(func.count(User.id)).where(User.is_deleted == False)  # noqa: E712
                )).scalar() or 0

                # Считаем анкеты актёров (ActorProfile) — именно они видны в
                # приложении. Раньше бралась устаревшая таблица profiles, где
                # одна строка на аккаунт, и цифра не совпадала ни с базой
                # актёров, ни с реальным числом анкет.
                profiles_total = (await session.execute(
                    select(func.count(ActorProfile.id))
                    .where(ActorProfile.is_deleted == False)  # noqa: E712
                )).scalar() or 0

                # «Готовые» анкеты — те же требования, что и в базе актёров
                # супер-админа: имя, пол, город и все обязательные фото. Рост и
                # размеры здесь намеренно не учитываем: они обязательны при
                # заполнении анкеты (см. actor_profiles.service), но у анкет,
                # созданных до этого правила, они могут быть пустыми, и такие
                # актёры не должны исчезать из базы супер-админа.
                complete_photos = (
                    select(MediaAsset.actor_profile_id)
                    .where(
                        MediaAsset.file_type == 'photo',
                        MediaAsset.photo_category.in_(REQUIRED_PHOTO_CATEGORIES),
                    )
                    .group_by(MediaAsset.actor_profile_id)
                    .having(
                        func.count(func.distinct(MediaAsset.photo_category))
                        == len(REQUIRED_PHOTO_CATEGORIES)
                    )
                )
                profiles_ready = (await session.execute(
                    select(func.count(ActorProfile.id)).where(
                        ActorProfile.is_deleted == False,  # noqa: E712
                        func.coalesce(func.btrim(ActorProfile.first_name), '') != '',
                        func.coalesce(func.btrim(ActorProfile.gender), '') != '',
                        func.coalesce(func.btrim(ActorProfile.city), '') != '',
                        ActorProfile.id.in_(complete_photos),
                    )
                )).scalar() or 0

                castings_total = (await session.execute(select(func.count(Casting.id)))).scalar() or 0
                castings_by_status = {}
                for casting_status, count in (await session.execute(
                    select(Casting.status, func.count(Casting.id)).group_by(Casting.status)
                )).all():
                    key = casting_status.value if hasattr(casting_status, 'value') else str(casting_status)
                    castings_by_status[key] = castings_by_status.get(key, 0) + (count or 0)

                roles = {}
                for role, is_verified in (await session.execute(
                    select(User.role, User.is_employer_verified).where(User.is_deleted == False)  # noqa: E712
                )).all():
                    role_key = role.value if hasattr(role, 'value') else str(role)
                    if role_key in ['employer', 'employer_pro'] and not is_verified:
                        role_key = f"pending_{role_key}"
                    roles[role_key] = roles.get(role_key, 0) + 1

                return {
                    "users_total": users_total,
                    "profiles_total": profiles_total,
                    "profiles_ready": profiles_ready,
                    "castings_total": castings_total,
                    "castings_by_status": castings_by_status,
                    "roles": roles,
                }

        @self.router.get("/users/")
        async def list_all_users(
            page: int = Query(1, gt=0),
            page_size: int = Query(50, gt=0),
            role: Optional[str] = Query(None),
            search: Optional[str] = Query(None),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: список всех пользователей."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import User
            from users.enums import ModelRoles
            from sqlalchemy import select, func, or_, false
            async with async_session_maker() as session:
                # Удалённые аккаунты в список не попадают — иначе он расходился
                # со статистикой по ролям, где они уже исключены.
                filters = [User.is_deleted == False]  # noqa: E712

                # Фильтр по роли считаем на сервере: раньше он применялся к уже
                # загруженной странице, поэтому счётчик над списком не совпадал
                # с цифрой на карточке роли в статистике.
                role_key = (role or '').strip()
                if role_key:
                    pending = role_key.startswith('pending_')
                    base_role = role_key[len('pending_'):] if pending else role_key
                    # Исторические синонимы ролей администраторов.
                    role_aliases = {
                        'employer': ('employer', 'administrator'),
                        'employer_pro': ('employer_pro', 'manager'),
                    }
                    role_values = [
                        ModelRoles(name)
                        for name in role_aliases.get(base_role, (base_role,))
                        if name in ModelRoles.__members__
                    ]
                    if not role_values:
                        # Неизвестная роль — отдаём пустой список, а не 500.
                        filters.append(false())
                    else:
                        filters.append(User.role.in_(role_values))
                        if base_role in ('employer', 'employer_pro'):
                            filters.append(User.is_employer_verified.is_(not pending))

                search_value = (search or '').strip()
                if search_value:
                    pattern = f"%{search_value}%"
                    filters.append(or_(
                        User.first_name.ilike(pattern),
                        User.last_name.ilike(pattern),
                        User.middle_name.ilike(pattern),
                        User.email.ilike(pattern),
                        User.phone_number.ilike(pattern),
                        User.telegram_username.ilike(pattern),
                        User.telegram_nick.ilike(pattern),
                        User.vk_nick.ilike(pattern),
                        User.max_nick.ilike(pattern),
                    ))

                total = (await session.execute(
                    select(func.count(User.id)).where(*filters)
                )).scalar() or 0
                query = (
                    select(User)
                    .where(*filters)
                    .order_by(User.created_at.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
                users = (await session.execute(query)).scalars().all()
                users_payload = []
                for u in users:
                    role_val = u.role.value if hasattr(u.role, 'value') else str(u.role)
                    photo_url = getattr(u, 'photo_url', None)

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
            page_size: int = Query(30, gt=0, le=100),
            search: Optional[str] = Query(None),
            city: Optional[str] = Query(None),
            metro_station: Optional[str] = Query(None),
            gender: Optional[str] = Query(None),
            look_type: Optional[str] = Query(None),
            hair_color: Optional[str] = Query(None),
            hair_length: Optional[str] = Query(None),
            age_from: Optional[int] = Query(None, ge=0, le=120),
            age_to: Optional[int] = Query(None, ge=0, le=120),
            exp_from: Optional[int] = Query(None, ge=0),
            exp_to: Optional[int] = Query(None, ge=0),
            height_from: Optional[int] = Query(None, ge=0),
            height_to: Optional[int] = Query(None, ge=0),
            clothing_from: Optional[float] = Query(None, ge=0),
            clothing_to: Optional[float] = Query(None, ge=0),
            shoe_from: Optional[float] = Query(None, ge=0),
            shoe_to: Optional[float] = Query(None, ge=0),
            bust_from: Optional[int] = Query(None, ge=0),
            bust_to: Optional[int] = Query(None, ge=0),
            waist_from: Optional[int] = Query(None, ge=0),
            waist_to: Optional[int] = Query(None, ge=0),
            hip_from: Optional[int] = Query(None, ge=0),
            hip_to: Optional[int] = Query(None, ge=0),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: все актёры — пользователи с ролью user/agent + их профили."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from datetime import timedelta
            from sqlalchemy import select, func, or_, cast, case, Numeric
            from sqlalchemy.orm import selectinload
            from users.models import User, ActorProfile, MediaAsset
            from users.enums import ModelRoles
            from actor_profiles.service import REQUIRED_PHOTO_CATEGORIES

            results = []
            async with async_session_maker() as session:
                base_user_q = select(User).where(User.role.in_([ModelRoles.user, ModelRoles.agent]))

                ap_conditions = [ActorProfile.is_deleted == False]  # noqa: E712

                # В базе актёров показываем только заполненные анкеты: имя, пол,
                # город и все обязательные фото. Недозаполненные и аккаунты вовсе
                # без анкеты в базу не попадают. Рост и размеры (тоже
                # обязательные при заполнении анкеты, см. actor_profiles.service)
                # здесь не требуем: у анкет, созданных до этого правила, они
                # бывают пустыми, а терять таких актёров из базы нельзя — их
                # по-прежнему можно найти и посмотреть.
                for column in (ActorProfile.first_name, ActorProfile.gender, ActorProfile.city):
                    ap_conditions.append(func.coalesce(func.btrim(column), '') != '')
                ap_conditions.append(
                    ActorProfile.id.in_(
                        select(MediaAsset.actor_profile_id)
                        .where(
                            MediaAsset.file_type == 'photo',
                            MediaAsset.photo_category.in_(REQUIRED_PHOTO_CATEGORIES),
                        )
                        .group_by(MediaAsset.actor_profile_id)
                        .having(
                            func.count(func.distinct(MediaAsset.photo_category))
                            == len(REQUIRED_PHOTO_CATEGORIES)
                        )
                    )
                )
                exact_filters = (
                    (ActorProfile.city, city),
                    (ActorProfile.metro_station, metro_station),
                    (ActorProfile.gender, gender),
                    (ActorProfile.look_type, look_type),
                    (ActorProfile.hair_color, hair_color),
                    (ActorProfile.hair_length, hair_length),
                )
                for column, value in exact_filters:
                    if value and value.strip():
                        ap_conditions.append(column == value.strip())

                now = datetime.now(timezone.utc).replace(tzinfo=None)
                if age_from is not None:
                    ap_conditions.append(ActorProfile.date_of_birth <= now - timedelta(days=365.2425 * age_from))
                if age_to is not None:
                    ap_conditions.append(ActorProfile.date_of_birth >= now - timedelta(days=365.2425 * (age_to + 1)))

                range_filters = (
                    (ActorProfile.experience, exp_from, exp_to),
                    (ActorProfile.height, height_from, height_to),
                    (ActorProfile.bust_volume, bust_from, bust_to),
                    (ActorProfile.waist_volume, waist_from, waist_to),
                    (ActorProfile.hip_volume, hip_from, hip_to),
                )
                for column, minimum, maximum in range_filters:
                    if minimum is not None:
                        ap_conditions.append(column >= minimum)
                    if maximum is not None:
                        ap_conditions.append(column <= maximum)

                def numeric_text(column):
                    normalized = func.replace(column, ",", ".")
                    return case(
                        (normalized.op("~")(r"^\d+(\.\d+)?$"), cast(normalized, Numeric)),
                        else_=None,
                    )

                clothing_numeric = numeric_text(ActorProfile.clothing_size)
                shoe_numeric = numeric_text(ActorProfile.shoe_size)
                if clothing_from is not None:
                    ap_conditions.append(clothing_numeric >= clothing_from)
                if clothing_to is not None:
                    ap_conditions.append(clothing_numeric <= clothing_to)
                if shoe_from is not None:
                    ap_conditions.append(shoe_numeric >= shoe_from)
                if shoe_to is not None:
                    ap_conditions.append(shoe_numeric <= shoe_to)

                search_value = search.strip() if search else ""
                if search_value:
                    pattern = f"%{search_value}%"
                    base_user_q = base_user_q.where(or_(
                        User.first_name.ilike(pattern),
                        User.last_name.ilike(pattern),
                        User.email.ilike(pattern),
                        User.id.in_(
                            select(ActorProfile.user_id).where(
                                ActorProfile.is_deleted == False,  # noqa: E712
                                or_(
                                    ActorProfile.first_name.ilike(pattern),
                                    ActorProfile.last_name.ilike(pattern),
                                    ActorProfile.display_name.ilike(pattern),
                                    ActorProfile.city.ilike(pattern),
                                    ActorProfile.metro_station.ilike(pattern),
                                    ActorProfile.about_me.ilike(pattern),
                                ),
                            )
                        ),
                    ))
                # Оставляем только пользователей, у которых есть хотя бы одна
                # подходящая анкета. Раньше это условие включалось только при
                # заданных фильтрах, из-за чего в базу попадали аккаунты вообще
                # без анкеты — карточками «Профиль не создан».
                base_user_q = base_user_q.where(
                    User.id.in_(select(ActorProfile.user_id).where(*ap_conditions))
                )

                total = (await session.execute(
                    select(func.count()).select_from(base_user_q.subquery())
                )).scalar() or 0

                user_q = (
                    base_user_q
                    .order_by(User.id.desc())
                    .offset((page - 1) * page_size)
                    .limit(page_size)
                )
                actor_users = (await session.execute(user_q)).scalars().all()

                # Батчево подгружаем анкеты всех пользователей страницы одним
                # запросом вместо запроса на каждого пользователя (N+1) — важно
                # при тысячах актёров в базе.
                user_ids = [u.id for u in actor_users]
                profiles_by_user: dict = {}
                if user_ids:
                    ap_rows = (await session.execute(
                        select(ActorProfile)
                        .options(selectinload(ActorProfile.media_assets))
                        .where(
                            ActorProfile.user_id.in_(user_ids),
                            *ap_conditions,
                        )
                    )).scalars().all()
                    for ap_row in ap_rows:
                        profiles_by_user.setdefault(ap_row.user_id, []).append(ap_row)

                for u in actor_users:
                    profiles_list = profiles_by_user.get(u.id, [])
                    # Анкету могли удалить между запросом списка и подгрузкой
                    # анкет — такого пользователя просто не показываем, чтобы в
                    # базе актёров не появлялось карточек без анкеты.
                    if not profiles_list:
                        continue

                    role_str = u.role.value if hasattr(u.role, 'value') else str(u.role)

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
                            "metro_station": p.metro_station,
                            "tax_status": p.tax_status,
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

            return {"actors": results, "total": total}

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
                #
                # ВАЖНО: у Profile.images жадная загрузка (lazy="joined"), поэтому
                # SQLAlchemy требует unique() перед выборкой — иначе на любом
                # пользователе, у которого есть legacy-анкета, запрос падает с
                # InvalidRequestError, и карточка не открывалась вообще.
                legacy_profile_result = await session.execute(
                    select(Profile).where(Profile.user_id == user_id)
                )
                # first(), а не scalar_one_or_none(): в миграционной базе у одного
                # аккаунта может оказаться несколько legacy-анкет, и падать из-за
                # этого целой карточкой пользователя нельзя.
                legacy_profile = legacy_profile_result.unique().scalars().first()

                castings_result = await session.execute(
                    select(Casting).where(Casting.owner_id == user_id).order_by(Casting.created_at.desc())
                )
                user_castings = castings_result.unique().scalars().all()

                # Отклики и shortlist собираем тремя запросами на всего
                # пользователя, а не запросом на каждый кастинг и на каждого
                # откликнувшегося: у активного админа это давало сотни
                # обращений к БД, и деталь профиля отваливалась по таймауту.
                casting_ids = [c.id for c in user_castings]

                # Берём только нужные колонки: у Response.profile жадная загрузка
                # вместе со всеми фото анкеты, и на сотнях откликов это тянуло из
                # базы кратно больше строк, чем нужно для списка.
                responses_by_casting: dict = {}
                if casting_ids:
                    resp_result = await session.execute(
                        select(
                            Response.id,
                            Response.casting_id,
                            Response.status,
                            Response.created_at,
                            Profile.id,
                            Profile.first_name,
                            Profile.last_name,
                        )
                        .join(Profile, Profile.id == Response.profile_id)
                        .where(Response.casting_id.in_(casting_ids))
                        .order_by(Response.created_at.desc())
                    )
                    for row in resp_result.all():
                        responses_by_casting.setdefault(row[1], []).append(row)

                # Пары (кастинг, анкета), попавшие в отчёты — по ним считаем и
                # признак shortlist у откликнувшегося, и итог по кастингу.
                shortlisted_pairs: set = set()
                shortlist_totals: dict = {}
                if casting_ids:
                    sl_result = await session.execute(
                        select(
                            Report.casting_id,
                            ProfilesReports.profile_id,
                            func.count(ProfilesReports.id),
                        )
                        .join(Report, Report.id == ProfilesReports.report_id)
                        .where(Report.casting_id.in_(casting_ids))
                        .group_by(Report.casting_id, ProfilesReports.profile_id)
                    )
                    for casting_id, profile_id, cnt in sl_result.all():
                        shortlisted_pairs.add((casting_id, profile_id))
                        shortlist_totals[casting_id] = shortlist_totals.get(casting_id, 0) + (cnt or 0)

                # Список откликнувшихся в карточке кастинга — обзорный, поэтому
                # ограничиваем его: у популярного кастинга иначе уезжают сотни
                # записей, и ответ распухает на мегабайты. Полное число берётся
                # из response_count.
                respondents_limit = 60

                castings_payload = []
                for c in user_castings:
                    casting_responses = responses_by_casting.get(c.id, [])
                    respondents_payload = []
                    response_total = len(casting_responses)
                    for row in casting_responses[:respondents_limit]:
                        (
                            response_id, _casting_id, response_status, responded_at,
                            profile_id, first_name, last_name,
                        ) = row
                        respondents_payload.append({
                            "profile_id": profile_id,
                            "response_id": response_id,
                            "first_name": first_name,
                            "last_name": last_name,
                            "responded_at": str(responded_at),
                            "is_shortlisted": (c.id, profile_id) in shortlisted_pairs,
                            "response_status": response_status or 'pending',
                        })

                    castings_payload.append({
                        "id": c.id,
                        "title": c.title,
                        "description": c.description,
                        "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                        "response_count": response_total,
                        "shortlist_count": shortlist_totals.get(c.id, 0),
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
                            "metro_station": p.metro_station,
                            "tax_status": p.tax_status,
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
                        return {"tickets": [], "total": 0, "unread_count": 0, "warning": "table_missing"}

                    unread_count = await _get_unread_ticket_count(session, int(authorized.id))

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
                        last_read_message_id = (await session.execute(
                            text(
                                "SELECT last_read_message_id FROM superadmin_ticket_reads "
                                "WHERE admin_id = :admin_id AND ticket_id = :ticket_id"
                            ),
                            {"admin_id": int(authorized.id), "ticket_id": int(t.id)},
                        )).scalar()
                        is_unread = bool(
                            t.status == 'open'
                            and last_msg
                            and int(getattr(last_msg, 'sender_id', 0) or 0) != int(authorized.id)
                            and int(last_read_message_id or 0) < int(last_msg.id)
                        )

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
                            "last_message_id": last_msg.id if last_msg else None,
                            "is_unread": is_unread,
                            "created_at": str(t.created_at),
                        })
                    await session.commit()
                    return {"tickets": result, "total": len(result), "unread_count": unread_count}
            except Exception as e:
                import traceback
                traceback.print_exc()
                raise HTTPException(status_code=500, detail=f"tickets error: {str(e)}")

        @self.router.get("/tickets/unread-count/")
        async def get_unread_tickets_count(
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: количество тикетов с непрочитанными сообщениями."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            async with async_session_maker() as session:
                unread_count = await _get_unread_ticket_count(session, int(authorized.id))
                await session.commit()
                return {"unread_count": unread_count}

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
                        "ticket_type": "support" if ticket.company_name == '__SUPPORT__' else "verification",
                        "status": ticket.status,
                        "company_name": ticket.company_name,
                        "about_text": ticket.about_text,
                        "projects_text": ticket.projects_text,
                        "experience_text": ticket.experience_text,
                        "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else '—',
                        "user_email": user.email if user else None,
                        "phone_number": user.phone_number if user else None,
                        "telegram_username": (
                            getattr(user, "telegram_nick", None)
                            or (f"@{user.telegram_username}" if user and getattr(user, "telegram_username", None) and not str(user.telegram_username).startswith("@") else getattr(user, "telegram_username", None))
                        ) if user else None,
                        "user_role": (user.role.value if hasattr(user.role, 'value') else str(user.role)) if user else None,
                        "is_verified": getattr(user, 'is_employer_verified', False) if user else False,
                        "created_at": str(ticket.created_at),
                    },
                    "messages": messages,
                }

        @self.router.post("/tickets/{ticket_id}/read/")
        async def mark_ticket_read(
            ticket_id: int,
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: отметить тикет прочитанным для текущего SuperAdmin."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            from postgres.database import async_session_maker
            from users.models import VerificationTicket
            async with async_session_maker() as session:
                ticket = await session.get(VerificationTicket, ticket_id)
                if not ticket:
                    raise HTTPException(status_code=404, detail="Ticket not found")
                last_read_message_id = await _mark_ticket_read(session, int(authorized.id), ticket_id)
                unread_count = await _get_unread_ticket_count(session, int(authorized.id))
                await session.commit()
                return {
                    "ok": True,
                    "ticket_id": ticket_id,
                    "last_read_message_id": last_read_message_id,
                    "unread_count": unread_count,
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
                is_support = ticket.company_name == '__SUPPORT__'
                user = await session.get(User, ticket.user_id)
                if user and not is_support:
                    user.is_employer_verified = True
                msg = TicketMessage(
                    ticket_id=ticket_id,
                    sender_id=int(authorized.id),
                    message="✅ Обращение закрыто." if is_support else "✅ Верификация одобрена. Доступ к публикации кастингов открыт.",
                )
                session.add(msg)
                await session.commit()
            return {"approved": True, "ticket_id": ticket_id, "ticket_type": "support" if is_support else "verification"}

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
            role: str = Query(..., description="Role to assign: user, agent, employer, employer_pro"),
            authorized: JWT = Depends(admin_authorized),
        ):
            """SuperAdmin: назначить роль любому пользователю (бесплатно)."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")

            # Роль owner (SuperAdmin) выдавать нельзя — второго супер-админа не создаём.
            if role in {'owner', Roles.owner.value}:
                raise HTTPException(status_code=403, detail="Нельзя назначить роль SuperAdmin")

            VALID_ROLES = {'user', 'agent', 'employer', 'employer_pro'}
            if role not in VALID_ROLES:
                raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(sorted(VALID_ROLES))}")

            from postgres.database import async_session_maker
            from users.models import User
            from users.enums import ModelRoles
            from billing.models import UserSubscription
            from sqlalchemy import update
            async with async_session_maker() as session:
                user = await session.get(User, user_id)
                if not user:
                    raise HTTPException(status_code=404, detail="User not found")

                current_role = (
                    user.role.value
                    if hasattr(user.role, "value")
                    else str(user.role)
                )
                if current_role == Roles.owner.value:
                    raise HTTPException(
                        status_code=403,
                        detail="Нельзя изменить роль SuperAdmin",
                    )

                user.role = ModelRoles(role)
                # Назначение роли SuperAdmin должно давать рабочий кабинет
                # сразу после повторного входа. Без этого employer_authorized
                # отклоняет нового Админа/Админа PRO с employer_not_verified.
                # При обратном переходе флаг очищаем, чтобы актёр или агент не
                # оставался скрыто верифицированным работодателем.
                is_employer_verified = role in {"employer", "employer_pro"}
                user.is_employer_verified = is_employer_verified

                # Это ручное бесплатное назначение роли, поэтому старая
                # платная подписка больше не должна управлять ролью: иначе
                # cron по её истечении позже молча вернёт пользователя в
                # `user`. Историю не удаляем — только выключаем автопродление
                # и закрываем активный/grace-период.
                subscription_result = await session.execute(
                    update(UserSubscription)
                    .where(
                        UserSubscription.user_id == user_id,
                        UserSubscription.status.in_(["active", "grace"]),
                    )
                    .values(
                        status="cancelled",
                        auto_renew=False,
                        updated_at=datetime.now(timezone.utc),
                    )
                )
                subscriptions_cancelled = subscription_result.rowcount or 0
                await session.commit()

            return {
                "ok": True,
                "user_id": user_id,
                "old_role": current_role,
                "new_role": role,
                "is_employer_verified": is_employer_verified,
                "subscriptions_cancelled": subscriptions_cancelled,
                "requires_relogin": True,
            }

        @self.router.post("/seed-demo-data/")
        async def seed_demo_data(
            force: bool = Query(False, description="Пересоздать пользователей (обновить пароли)"),
            authorized: JWT = Depends(admin_authorized),
        ):
            """Заполнить БД демо-данными (4 админа + 3 актёра + 2 агента с откликами)."""
            if authorized.role not in [Roles.owner.value, 'owner']:
                raise HTTPException(status_code=403, detail="Only SuperAdmin")
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
                {"title": "Сериал «Большой город»", "description": "Многосерийная история о жизни молодёжи в мегаполисе. Современный сюжет, живые персонажи.", "castings": [
                    {"title": "Кастинг на роль студента Кирилла", "description": "Молодой человек 18-25 лет, харизматичный, умеет работать в кадре."},
                ]},
                {"title": "Рекламный ролик BRAND X", "description": "Съёмки рекламного ролика для крупного бренда. Оплата 50 000 руб./день.", "castings": [
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
