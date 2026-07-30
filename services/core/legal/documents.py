"""
Единый источник истины по актуальным редакциям юридических документов
Платформы. Версия здесь ОБЯЗАНА совпадать с таблицей реквизитов
(«Дата и № редакции») внутри самого текста документа, который публикуется
на фронтенде (frontend/apps/tma/src/shared/legal/content.tsx).

При выпуске новой редакции документа:
  1) обновить текст в content.tsx (включая строку «Дата и № редакции»);
  2) обновить соответствующую константу версии здесь;
после этого у всех пользователей, ранее принявших документ, флаг
`accepted` в /legal/consent/status/ автоматически станет False, и при
следующем входе им покажут экран повторного принятия новой редакции.
"""
from enum import Enum


class DocumentType(str, Enum):
    USER_AGREEMENT = "user_agreement"
    PUBLIC_OFFER = "public_offer"


# Дата и № редакции — как в таблице реквизитов в конце документов.
CURRENT_VERSIONS: dict[str, str] = {
    DocumentType.USER_AGREEMENT.value: "27.07.2026 №1",
    DocumentType.PUBLIC_OFFER.value: "27.07.2026 №1",
}

# Публичные страницы документов на сайте (без авторизации) — используются,
# например, для указания «Ссылки на страницу с реквизитами» в ЮKassa.
DOCUMENT_URLS: dict[str, str] = {
    DocumentType.USER_AGREEMENT.value: "https://prostoprobuy.pro/legal/agreement",
    DocumentType.PUBLIC_OFFER.value: "https://prostoprobuy.pro/legal/offer",
}

ALL_DOCUMENT_TYPES: tuple[str, ...] = tuple(d.value for d in DocumentType)
