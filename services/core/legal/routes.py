"""
Роуты для акцепта Пользовательского соглашения и Публичной оферты.

Тексты самих документов публикуются как обычные (без авторизации) страницы
на фронтенде — /legal/agreement и /legal/offer (см. legal.documents.DOCUMENT_URLS).
Здесь только API для экрана принятия внутри приложения: статус и фиксация акцепта.
"""
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, Request

from users.services.auth_token.types.jwt import JWT
from users.dependencies.auth_depends import tma_authorized
from legal.service import LegalConsentService
from legal.documents import ALL_DOCUMENT_TYPES, CURRENT_VERSIONS, DOCUMENT_URLS


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
                for doc_type in ALL_DOCUMENT_TYPES
            }

        @self.router.get("/consent/status/")
        async def get_consent_status(
            authorized: JWT = Depends(tma_authorized),
        ):
            """Принял ли текущий пользователь действующую редакцию каждого документа."""
            return await LegalConsentService.get_status(user_id=int(authorized.id))

        @self.router.post("/consent/accept/")
        async def accept_consent(
            request: Request,
            documents: Optional[List[str]] = Body(default=None, embed=True),
            authorized: JWT = Depends(tma_authorized),
        ):
            """
            Зафиксировать акцепт действующей редакции документов.

            `documents` — список из ['user_agreement', 'public_offer'];
            если не передан, фиксируются оба документа. Версия берётся
            сервером (см. legal.service.LegalConsentService), а не из тела запроса.
            """
            return await LegalConsentService.record_consent(
                user_id=int(authorized.id),
                documents=documents,
                ip_address=_client_ip(request),
                user_agent=request.headers.get("user-agent"),
            )
