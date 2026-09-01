"""
Сервис фиксации акцепта юридических документов Платформы.

Логика:
  - "Требуется принять" считается по совпадению версии в CURRENT_VERSIONS
    с последней НЕ отозванной принятой пользователем версией данного документа.
  - Какие документы обязательны именно для этого пользователя, определяется
    его ролью (см. legal.documents.required_documents_for_role) — например,
    Публичная оферта относится только к Администратору/Администратору PRO,
    а Согласие на использование фото и Согласие на распространение — не входят
    в общий гейт вовсе (они контекстные и спрашиваются в момент действия —
    загрузка фото, создание/публикация Анкеты).
    Пока платные тарифы не запущены, Публичная оферта не обязательна ни для
    одной роли (см. legal.documents.PAYMENT_DOCUMENTS_ENABLED): в статусе она
    остаётся с `required: false`, чтобы сохранилась история прежних акцептов.
  - Каждый акцепт — новая строка в legal_consents (append-only журнал,
    используется как электронное доказательство факта и момента акцепта).
  - Версия, которая фиксируется при акцепте, берётся ИСКЛЮЧИТЕЛЬНО из
    CURRENT_VERSIONS на сервере (не из тела запроса клиента) — это исключает
    возможность подделать акцепт устаревшей или произвольной редакции.
  - Отзыв (например, рекламной рассылки) не удаляет и не переписывает
    запись об акцепте — только помечает её `revoked_at`, сохраняя полную
    историю согласия и отзыва.
  - `record_profile_consent` — отдельная ветка для Согласия Актёра на
    обработку данных Агентом / Согласия законного представителя
    несовершеннолетнего, которые собираются на публичном экране
    /confirm-authority/{token} и не привязаны к user_id (см.
    legal.documents.PROFILE_DOCUMENT_TYPES и actor_profiles.service).
"""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, desc, update

from postgres.database import async_session_maker as async_session
from legal.models import LegalConsent
from legal.documents import (
    ALL_DOCUMENT_TYPES,
    CURRENT_VERSIONS,
    DOCUMENT_URLS,
    PROFILE_DOCUMENT_TYPES,
    required_documents_for_role,
)


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
        categories: Optional[dict[str, list[str]]] = None,
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
                        categories=(categories or {}).get(doc_type),
                        ip_address=ip_address,
                        user_agent=(user_agent[:2000] if user_agent else None),
                        accepted_at=datetime.now(timezone.utc),
                    )
                )
            await session.commit()

        return await LegalConsentService.get_status(user_id, role)

    @staticmethod
    async def record_profile_consent(
        actor_profile_id: int,
        documents: list[str],
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        categories: Optional[dict[str, list[str]]] = None,
        role: Optional[str] = None,
    ) -> None:
        """
        Зафиксировать согласия Актёра/представителя, у которого нет своего
        аккаунта (Анкету создал Агент) — экран /confirm-authority/{token}.
        Принимает как документы уровня анкеты (agent_authority_consent,
        minor_representative_consent), так и относящиеся лично к Актёру
        документы уровня пользователя (cross_border_consent, image_consent,
        distribution_consent), которые в этом случае тоже физически
        привязываются к actor_profile_id, а не к user_id.

        `role` — в каком качестве дано согласие. Для анкеты несовершеннолетнего
        это принципиально различает два случая (см. actor_profiles.service):
        `legal_representative` — представитель заполнил анкету сам, и
        `minor_self` — несовершеннолетний заполнил сам, заявив, что изучил
        документы вместе с представителем.
        """
        target_documents = [d for d in documents if d in ALL_DOCUMENT_TYPES or d in PROFILE_DOCUMENT_TYPES]

        async with async_session() as session:
            for doc_type in target_documents:
                session.add(
                    LegalConsent(
                        actor_profile_id=actor_profile_id,
                        document_type=doc_type,
                        version=CURRENT_VERSIONS[doc_type],
                        role=role,
                        categories=(categories or {}).get(doc_type),
                        ip_address=ip_address,
                        user_agent=(user_agent[:2000] if user_agent else None),
                        accepted_at=datetime.now(timezone.utc),
                    )
                )
            await session.commit()

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
