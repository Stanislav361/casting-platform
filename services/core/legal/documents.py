"""
Единый источник истины по актуальным редакциям юридических документов
Платформы. Версия здесь ОБЯЗАНА совпадать с таблицей реквизитов
(«Дата и № редакции») внутри самого текста документа, который публикуется
на фронтенде (frontend/apps/tma/src/shared/legal/*-content.ts).

Распределение документов по ролям — из внутренней инструкции по внедрению
документов и обязательным техническим действиям («Комплект по ролям»):

  Актёр:            Пользовательское соглашение; Политика обработки ПД;
                     Согласие на обработку ПД. Изображение — отдельно, в
                     момент загрузки фото/видео (см. IMAGE_CONSENT).
                     Реклама — добровольно (MARKETING_CONSENT, не блокирует).
  Агент:             тот же комплект, что у Актёра (без фото — своих фото
                     агент не грузит).
  Администратор/PRO: Пользовательское соглашение; Политика обработки ПД;
                     Согласие на обработку ПД; Публичная оферта.
  Любая роль:        Политика cookie — информационная, без чек-бокса
                     (см. INFORMATIONAL_DOCUMENT_TYPES): на дату редакции
                     используются только строго необходимые cookie.

При выпуске новой редакции документа:
  1) обновить текст в соответствующем *-content.ts (включая строку
     «Дата и № редакции»);
  2) обновить соответствующую константу версии здесь;
после этого у всех пользователей, ранее принявших документ, флаг
`accepted` в /legal/consent/status/ автоматически станет False, и при
следующем входе им покажут экран повторного принятия новой редакции.
"""
from enum import Enum


class DocumentType(str, Enum):
    USER_AGREEMENT = "user_agreement"
    PUBLIC_OFFER = "public_offer"
    PRIVACY_POLICY = "privacy_policy"
    DATA_PROCESSING_CONSENT = "data_processing_consent"
    MARKETING_CONSENT = "marketing_consent"
    IMAGE_CONSENT = "image_consent"
    COOKIE_POLICY = "cookie_policy"


# Дата и № редакции — как в таблице реквизитов в конце документов.
CURRENT_VERSIONS: dict[str, str] = {
    DocumentType.USER_AGREEMENT.value: "27.07.2026 №1",
    DocumentType.PUBLIC_OFFER.value: "27.07.2026 №1",
    DocumentType.PRIVACY_POLICY.value: "02.08.2026 №1",
    DocumentType.DATA_PROCESSING_CONSENT.value: "02.08.2026 №1",
    DocumentType.MARKETING_CONSENT.value: "02.08.2026 №1",
    DocumentType.IMAGE_CONSENT.value: "02.08.2026 №1",
    DocumentType.COOKIE_POLICY.value: "02.08.2026 №1",
}

# Публичные страницы документов на сайте (без авторизации) — используются,
# например, для указания «Ссылки на страницу с реквизитами» в ЮKassa.
DOCUMENT_URLS: dict[str, str] = {
    DocumentType.USER_AGREEMENT.value: "https://prostoprobuy.pro/legal/agreement",
    DocumentType.PUBLIC_OFFER.value: "https://prostoprobuy.pro/legal/offer",
    DocumentType.PRIVACY_POLICY.value: "https://prostoprobuy.pro/legal/privacy-policy",
    DocumentType.DATA_PROCESSING_CONSENT.value: "https://prostoprobuy.pro/legal/data-consent",
    DocumentType.MARKETING_CONSENT.value: "https://prostoprobuy.pro/legal/marketing-consent",
    DocumentType.IMAGE_CONSENT.value: "https://prostoprobuy.pro/legal/image-consent",
    DocumentType.COOKIE_POLICY.value: "https://prostoprobuy.pro/legal/cookies",
}

ALL_DOCUMENT_TYPES: tuple[str, ...] = tuple(d.value for d in DocumentType)

# Документы, обязательные к акцепту ПРИ РЕГИСТРАЦИИ/входе — именно они
# блокируют доступ к интерфейсу через legal-consent-gate, пока не приняты.
# Роли из users.enums.Roles / ModelRoles.
_BASE_REQUIRED = (
    DocumentType.USER_AGREEMENT.value,
    DocumentType.PRIVACY_POLICY.value,
    DocumentType.DATA_PROCESSING_CONSENT.value,
)
_ADMIN_REQUIRED = _BASE_REQUIRED + (DocumentType.PUBLIC_OFFER.value,)

ROLE_REQUIRED_DOCUMENTS: dict[str, tuple[str, ...]] = {
    "user": _BASE_REQUIRED,
    "agent": _BASE_REQUIRED,
    "employer": _ADMIN_REQUIRED,
    "employer_pro": _ADMIN_REQUIRED,
    "administrator": _ADMIN_REQUIRED,
    "manager": _ADMIN_REQUIRED,
    "producer": _BASE_REQUIRED,
    "owner": _ADMIN_REQUIRED,
}

# Добровольное согласие: не блокирует ничего, управляется тумблером в
# Настройках, может быть отозвано (см. legal.service.revoke_consent).
OPTIONAL_DOCUMENT_TYPES: tuple[str, ...] = (DocumentType.MARKETING_CONSENT.value,)

# Контекстное согласие: спрашивается не при регистрации, а в момент
# конкретного действия (загрузка фото/видео Анкеты Актёра).
CONTEXTUAL_DOCUMENT_TYPES: tuple[str, ...] = (DocumentType.IMAGE_CONSENT.value,)

# Информационные документы: публикуются и доступны по ссылке, но не требуют
# отдельного чек-бокса (на дату редакции используются только строго
# необходимые cookie — см. Политику использования файлов cookie).
INFORMATIONAL_DOCUMENT_TYPES: tuple[str, ...] = (DocumentType.COOKIE_POLICY.value,)


def required_documents_for_role(role: str | None) -> tuple[str, ...]:
    """Документы, обязательные к акцепту при регистрации/входе для данной роли."""
    return ROLE_REQUIRED_DOCUMENTS.get(role or "", _BASE_REQUIRED)
