"""
Роуты для акцепта юридических документов Платформы.

Тексты самих документов публикуются как обычные (без авторизации) страницы
на фронтенде — /legal/agreement, /legal/privacy-policy, /legal/data-consent,
/legal/marketing-consent, /legal/image-consent, /legal/cookies
(см. legal.documents.DOCUMENT_URLS). Публичная оферта (/legal/offer) скрыта,
пока не запущен платный доступ — см. PAYMENT_DOCUMENTS_ENABLED.
Здесь только API для экрана принятия внутри приложения: статус (с учётом
роли пользователя — какие документы обязательны именно для неё) и фиксация
акцепта/отзыва.
"""
from typing import Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Request

from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import tma_authorized
from legal.service import LegalConsentService
from legal.documents import (
    ALL_DOCUMENT_TYPES,
    CURRENT_VERSIONS,
    DOCUMENT_URLS,
    PAYMENT_DOCUMENT_TYPES,
    PAYMENT_DOCUMENTS_ENABLED,
)

# Что отдаём в публичном каталоге документов. Пока платные тарифы не запущены,
# Публичная оферта не опубликована (страница /legal/offer скрыта), поэтому
# ссылку на неё не показываем — см. legal.documents.PAYMENT_DOCUMENTS_ENABLED.
# В /legal/consent/status/ документ остаётся, чтобы сохранить историю акцептов.
_PUBLISHED_DOCUMENT_TYPES: tuple[str, ...] = tuple(
    doc_type
    for doc_type in ALL_DOCUMENT_TYPES
    if PAYMENT_DOCUMENTS_ENABLED or doc_type not in PAYMENT_DOCUMENT_TYPES
)


def _client_ip(request: Request) -> Optional[str]:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


class LegalRouter:
    def __init__(self):
        self.router = APIRouter(tags=["legal"], prefix="/legal")
        self._include()

    def _include(self):
        @self.router.get("/documents/")
        async def get_documents():
            """Публичные метаданные документов: действующая редакция и ссылка."""
            return {
                doc_type: {"version": CURRENT_VERSIONS[doc_type], "url": DOCUMENT_URLS[doc_type]}
                for doc_type in _PUBLISHED_DOCUMENT_TYPES
            }

        @self.router.get("/consent/status/")
        async def get_consent_status(
            authorized: JWT = Depends(tma_authorized),
        ):
            """
            Принял ли текущий пользователь действующую редакцию каждого документа.

            Для каждого документа возвращается `required` — обязателен ли он
            именно для роли текущего пользователя (см. ROLE_REQUIRED_DOCUMENTS).
            `all_accepted` считается только по обязательным для роли документам.
            """
            return await LegalConsentService.get_status(user_id=int(authorized.id), role=authorized.role)

        @self.router.post("/consent/accept/")
        async def accept_consent(
            request: Request,
            documents: Optional[List[str]] = Body(default=None, embed=True),
            categories: Optional[Dict[str, List[str]]] = Body(default=None, embed=True),
            authorized: JWT = Depends(tma_authorized),
        ):
            """
            Зафиксировать акцепт действующей редакции документов.

            `documents` — список типов документов; если не передан, фиксируются
            все известные документы. Версия берётся сервером (см.
            legal.service.LegalConsentService), а не из тела запроса.
            `categories` — детальный выбор категорий данных для Согласия на
            распространение, например `{"distribution_consent": ["photos", ...]}`
            (см. legal.documents.DISTRIBUTION_CATEGORIES).
            """
            return await LegalConsentService.record_consent(
                user_id=int(authorized.id),
                documents=documents,
                ip_address=_client_ip(request),
                user_agent=request.headers.get("user-agent"),
                role=authorized.role,
                categories=categories,
            )

        @self.router.post("/consent/revoke/")
        async def revoke_consent(
            document_type: str = Body(..., embed=True),
            authorized: JWT = Depends(tma_authorized),
        ):
            """Отозвать ранее данное согласие (например, на рекламную рассылку)."""
            return await LegalConsentService.revoke_consent(
                user_id=int(authorized.id),
                document_type=document_type,
                role=authorized.role,
            )
