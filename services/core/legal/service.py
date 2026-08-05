"""
Сервис фиксации акцепта юридических документов Платформы.

Логика:
  - "Требуется принять" считается по совпадению версии в CURRENT_VERSIONS
    с последней НЕ отозванной принятой пользователем версией данного документа.
  - Какие документы обязательны именно для этого пользователя, определяется
    его ролью (см. legal.documents.required_documents_for_role) — например,
    Публичная оферта обязательна только для Администратора/Администратора PRO,
    а Согласие на использование фото — не входит в общий гейт вовсе (оно
    контекстное и спрашивается на странице загрузки фото).
  - Каждый акцепт — новая строка в legal_consents (append-only журнал,
    используется как электронное доказательство факта и момента акцепта).
  - Версия, которая фиксируется при акцепте, берётся ИСКЛЮЧИТЕЛЬНО из
    CURRENT_VERSIONS на сервере (не из тела запроса клиента) — это исключает
    возможность подделать акцепт устаревшей или произвольной редакции.
  - Отзыв (например, рекламной рассылки) не удаляет и не переписывает
    запись об акцепте — только помечает её `revoked_at`, сохраняя полную
    историю согласия и отзыва.
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, desc, update

from postgres.database import async_session_maker as async_session
from legal.models import LegalConsent
from legal.documents import ALL_DOCUMENT_TYPES, CURRENT_VERSIONS, DOCUMENT_URLS, required_documents_for_role


class LegalConsentService:
    """Проверка и фиксация согласия пользователя с документами Платформы."""

    @staticmethod
    async def get_status(user_id: int, role: Optional[str] = None) -> dict:
        required = set(required_documents_for_role(role))

        async with async_session() as session:
            result: dict = {}
            for doc_type in ALL_DOCUMENT_TYPES:
                current_version = CURRENT_VERSIONS[doc_type]
                row = (
                    await session.execute(
                        select(LegalConsent)
                        .where(
                            LegalConsent.user_id == user_id,
                            LegalConsent.document_type == doc_type,
                            LegalConsent.revoked_at.is_(None),
                        )
                        .order_by(desc(LegalConsent.accepted_at))
                        .limit(1)
                    )
                ).scalar_one_or_none()

                accepted = bool(row and row.version == current_version)
                result[doc_type] = {
                    "version": current_version,
                    "url": DOCUMENT_URLS[doc_type],
                    "accepted": accepted,
                    "accepted_at": row.accepted_at.isoformat() if (row and accepted) else None,
                    "required": doc_type in required,
                }

            result["all_accepted"] = all(
                result[d]["accepted"] for d in ALL_DOCUMENT_TYPES if result[d]["required"]
            )
            return result

    @staticmethod
    async def record_consent(
        user_id: int,
        documents: Optional[list[str]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        role: Optional[str] = None,
    ) -> dict:
        target_documents = [d for d in (documents or list(ALL_DOCUMENT_TYPES)) if d in ALL_DOCUMENT_TYPES]

        async with async_session() as session:
            for doc_type in target_documents:
                session.add(
                    LegalConsent(
                        user_id=user_id,
                        document_type=doc_type,
                        version=CURRENT_VERSIONS[doc_type],
                        role=role,
                        ip_address=ip_address,
                        user_agent=(user_agent[:2000] if user_agent else None),
                        accepted_at=datetime.now(timezone.utc),
                    )
                )
            await session.commit()

        return await LegalConsentService.get_status(user_id, role)

    @staticmethod
    async def revoke_consent(
        user_id: int,
        document_type: str,
        role: Optional[str] = None,
    ) -> dict:
        """Отозвать действующее согласие (например, на рекламную рассылку)."""
        if document_type not in ALL_DOCUMENT_TYPES:
            return await LegalConsentService.get_status(user_id, role)

        async with async_session() as session:
            row = (
                await session.execute(
                    select(LegalConsent)
                    .where(
                        LegalConsent.user_id == user_id,
                        LegalConsent.document_type == document_type,
                        LegalConsent.revoked_at.is_(None),
                    )
                    .order_by(desc(LegalConsent.accepted_at))
                    .limit(1)
                )
            ).scalar_one_or_none()

            if row is not None:
                await session.execute(
                    update(LegalConsent)
                    .where(LegalConsent.id == row.id)
                    .values(revoked_at=datetime.now(timezone.utc))
                )
                await session.commit()

        return await LegalConsentService.get_status(user_id, role)
