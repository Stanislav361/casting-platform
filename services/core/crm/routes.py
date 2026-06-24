"""
Season 04: CRM Routes.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import tma_authorized, employer_authorized, admin_authorized
from crm.service import NotificationService, TrustScoreService, BlacklistService, ActionLogService
from users.enums import Roles


class NotificationRouter:
    def __init__(self):
        self.router = APIRouter(tags=["notifications"], prefix="/notifications")
        self._include()

    def _include(self):
        @self.router.get("/")
        async def get_notifications(
            unread_only: bool = Query(False),
            page: int = Query(1, gt=0),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Мои уведомления."""
            return await NotificationService.get_user_notifications(
                user_id=int(authorized.id), unread_only=unread_only, page=page
            )

        @self.router.post("/read/")
        async def mark_read(
            notification_id: Optional[int] = Query(None),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Отметить прочитанным (одно или все)."""
            await NotificationService.mark_read(
                user_id=int(authorized.id), notification_id=notification_id
            )
            return {"status": "ok"}

        @self.router.post("/test/")
        async def send_test_notification(
            authorized: JWT = Depends(tma_authorized),
        ):
            """ВРЕМЕННЫЙ диагностический эндпоинт.

            Отправляет тестовое уведомление самому себе по реальному пути
            (колокольчик в приложении + web-push + внешний канал по выбору) и
            дополнительно делает ЯВНУЮ попытку отправки на email с возвратом
            ошибки, чтобы видеть, доходит ли письмо. Удалить после проверки.
            """
            # Никогда не отдаём 500: любая ошибка возвращается как JSON, иначе на
            # этом бэкенде ответ-ошибка приходит без CORS-заголовков и браузер
            # показывает «нет связи с сервером».
            result = {
                "ok": False,
                "notification_id": None,
                "your_email": None,
                "casting_notification_channel": None,
                "email_configured": None,
                "email_test": "skipped",
                "email_error": None,
                "error": None,
            }
            try:
                from postgres.database import async_session_maker
                from users.models import User
                from crm.models import NotificationType
                from shared.services.email.service import EmailDeliveryService

                user_id = int(authorized.id)
                async with async_session_maker() as session:
                    user = await session.get(User, user_id)
                if not user:
                    result["error"] = "user_not_found"
                    return result

                result["your_email"] = user.email
                result["casting_notification_channel"] = (
                    getattr(user, 'casting_notification_channel', 'in_app') or 'in_app'
                )
                result["email_configured"] = EmailDeliveryService.is_configured()

                try:
                    result["notification_id"] = await NotificationService.create(
                        user_id=user_id,
                        type=NotificationType.SYSTEM,
                        title="Тестовое уведомление",
                        message="Проверка доставки уведомлений. Если письмо пришло на почту — email-уведомления работают.",
                    )
                except Exception as exc:
                    result["error"] = f"create_failed: {type(exc).__name__}: {exc}"

                if user.email and result["email_configured"]:
                    try:
                        await EmailDeliveryService.send_notification_email(
                            to_email=user.email,
                            subject="Тестовое уведомление prostoprobuy",
                            message="Это тестовое письмо-уведомление. Если вы его получили — доставка email работает корректно.",
                        )
                        result["email_test"] = "sent"
                    except Exception as exc:
                        result["email_test"] = "failed"
                        result["email_error"] = f"{type(exc).__name__}: {exc}"
                elif not user.email:
                    result["email_test"] = "no_email_on_account"
                else:
                    result["email_test"] = "email_provider_not_configured"

                result["ok"] = result["error"] is None
                return result
            except Exception as exc:
                result["error"] = f"unexpected: {type(exc).__name__}: {exc}"
                return result


class TrustScoreRouter:
    def __init__(self):
        self.router = APIRouter(tags=["trust-score"], prefix="/trust-score")
        self._include()

    def _include(self):
        @self.router.get("/{profile_id}/")
        async def get_trust_score(
            profile_id: int,
            authorized: JWT = Depends(tma_authorized),
        ):
            """Получить Trust Score профиля."""
            role = authorized.role
            if role in [Roles.user.value, 'user', Roles.agent.value, 'agent']:
                from postgres.database import async_session_maker
                from profiles.models import Profile
                async with async_session_maker() as session:
                    profile = await session.get(Profile, profile_id)
                    if not profile or int(profile.user_id) != int(authorized.id):
                        raise HTTPException(status_code=403, detail="Нет доступа к Trust Score")
            return await TrustScoreService.calculate_score(profile_id)

        @self.router.post("/{profile_id}/event/")
        async def add_trust_event(
            profile_id: int,
            event_type: str = Query(...),
            description: Optional[str] = Query(None),
            authorized: JWT = Depends(admin_authorized),
        ):
            """Добавить событие Trust Score (admin)."""
            return await TrustScoreService.add_event(
                profile_id=profile_id, event_type=event_type, description=description
            )


class BlacklistRouter:
    def __init__(self):
        self.router = APIRouter(tags=["blacklist"], prefix="/blacklist")
        self._include()

    def _include(self):
        @self.router.get("/")
        async def get_blacklist(
            page: int = Query(1, gt=0),
            authorized: JWT = Depends(admin_authorized),
        ):
            """Список заблокированных пользователей."""
            return await BlacklistService.get_blacklist(page=page)

        @self.router.post("/ban/")
        async def ban_user(
            user_id: int = Query(...),
            ban_type: str = Query(..., description="temporary or permanent"),
            reason: str = Query(...),
            days: Optional[int] = Query(None),
            authorized: JWT = Depends(admin_authorized),
        ):
            """Заблокировать пользователя."""
            return await BlacklistService.ban_user(
                user_id=user_id, ban_type=ban_type, reason=reason,
                banned_by=int(authorized.id), days=days,
            )

        @self.router.post("/unban/")
        async def unban_user(
            user_id: int = Query(...),
            authorized: JWT = Depends(admin_authorized),
        ):
            """Разблокировать пользователя."""
            return await BlacklistService.unban_user(user_id=user_id)

        @self.router.post("/cron/check-expired/")
        async def cron_check_bans(
            authorized: JWT = Depends(admin_authorized),
        ):
            """Cron: снять истёкшие временные баны."""
            count = await BlacklistService.check_expired_bans()
            return {"expired_bans_removed": count}


class CollaborationRouter:
    def __init__(self):
        self.router = APIRouter(tags=["collaboration"], prefix="/collaboration")
        self._include()

    def _include(self):
        @self.router.post("/casting/{casting_id}/comment/")
        async def add_comment(
            casting_id: int,
            message: str = Query(...),
            tagged_user_ids: Optional[str] = Query(None, description="Comma-separated user IDs"),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Добавить комментарий в карточку проекта (с тегами коллег)."""
            tags = [int(x.strip()) for x in tagged_user_ids.split(",")] if tagged_user_ids else None
            return await ActionLogService.add_comment(
                casting_id=casting_id,
                user_id=int(authorized.id),
                message=message,
                tagged_user_ids=tags,
            )

        @self.router.get("/casting/{casting_id}/log/")
        async def get_casting_log(
            casting_id: int,
            page: int = Query(1, gt=0),
            authorized: JWT = Depends(employer_authorized),
        ):
            """Лог действий (микро-чат) внутри карточки проекта."""
            return await ActionLogService.get_casting_log(
                casting_id=casting_id, page=page
            )
