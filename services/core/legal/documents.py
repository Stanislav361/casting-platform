"""
Единый источник истины по актуальным редакциям юридических документов
Платформы. Версия здесь ОБЯЗАНА совпадать с таблицей реквизитов
(«Дата и № редакции») внутри самого текста документа, который публикуется
на фронтенде (frontend/apps/tma/src/shared/legal/*-content.ts).

Распределение документов по ролям — из внутренней инструкции по внедрению
документов и обязательным техническим действиям («Комплект по ролям»):

  Актёр:            Пользовательское соглашение; Политика обработки ПД;
                     Согласие на обработку ПД; Согласие на трансграничную
                     передачу — при регистрации. Изображение и Согласие на
                     распространение — отдельно, контекстно (в момент
                     загрузки фото/видео и при создании Анкеты, см.
                     CONTEXTUAL_DOCUMENT_TYPES). Реклама — добровольно
                     (MARKETING_CONSENT, не блокирует).
  Агент:             тот же базовый комплект, что у Актёра (без фото и без
                     распространения — своих данных на распространение
                     агент не даёт, это делает сам Актёр/представитель).
  Администратор/PRO: Пользовательское соглашение; Политика обработки ПД;
                     Согласие на обработку ПД; Согласие на трансграничную
                     передачу; Публичная оферта — пока отключена, платных
                     тарифов на Платформе нет (см. PAYMENT_DOCUMENTS_ENABLED).
  Любая роль:        Политика cookie — информационная, без чек-бокса
                     (см. INFORMATIONAL_DOCUMENT_TYPES): на дату редакции
                     используются только строго необходимые cookie.

  Анкета, созданная Агентом (или несовершеннолетнего, через законного
  представителя) — особый случай: у Актёра может не быть отдельного
  аккаунта, поэтому Согласие Актёра на обработку данных Агентом
  (AGENT_AUTHORITY_CONSENT) либо Согласие законного представителя
  несовершеннолетнего (MINOR_REPRESENTATIVE_CONSENT), а также относящиеся
  лично к Актёру трансграничная передача/изображение/распространение
  собираются на публичном экране подтверждения полномочий
  (/confirm-authority/{token}) и хранятся в legal_consents с привязкой к
  actor_profile_id, а не к user_id — см. actor_profiles.service. Эти два
  документа НЕ входят в общий per-role гейт (ROLE_REQUIRED_DOCUMENTS) и не
  учитываются в /legal/consent/status/ — см. PROFILE_DOCUMENT_TYPES.

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
    DISTRIBUTION_CONSENT = "distribution_consent"
    CROSS_BORDER_CONSENT = "cross_border_consent"
    AGENT_AUTHORITY_CONSENT = "agent_authority_consent"
    MINOR_REPRESENTATIVE_CONSENT = "minor_representative_consent"


# Дата и № редакции — как в таблице реквизитов в конце документов.
CURRENT_VERSIONS: dict[str, str] = {
    DocumentType.USER_AGREEMENT.value: "27.07.2026 №1",
    DocumentType.PUBLIC_OFFER.value: "27.07.2026 №1",
    DocumentType.PRIVACY_POLICY.value: "07.08.2026 №2",
    DocumentType.DATA_PROCESSING_CONSENT.value: "07.08.2026 №2",
    DocumentType.MARKETING_CONSENT.value: "02.08.2026 №1",
    DocumentType.IMAGE_CONSENT.value: "07.08.2026 №2",
    DocumentType.COOKIE_POLICY.value: "02.08.2026 №1",
    DocumentType.DISTRIBUTION_CONSENT.value: "06.08.2026 №1",
    DocumentType.CROSS_BORDER_CONSENT.value: "07.08.2026 №1",
    DocumentType.AGENT_AUTHORITY_CONSENT.value: "07.08.2026 №2",
    DocumentType.MINOR_REPRESENTATIVE_CONSENT.value: "07.08.2026 №2",
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
    DocumentType.DISTRIBUTION_CONSENT.value: "https://prostoprobuy.pro/legal/distribution-consent",
    DocumentType.CROSS_BORDER_CONSENT.value: "https://prostoprobuy.pro/legal/cross-border-consent",
    DocumentType.AGENT_AUTHORITY_CONSENT.value: "https://prostoprobuy.pro/legal/agent-authority-consent",
    DocumentType.MINOR_REPRESENTATIVE_CONSENT.value: "https://prostoprobuy.pro/legal/minor-consent",
}

# Документы «уровня пользователя» — учитываются в /legal/consent/status/ и
# хранятся с привязкой к user_id. AGENT_AUTHORITY_CONSENT и
# MINOR_REPRESENTATIVE_CONSENT сюда не входят — см. PROFILE_DOCUMENT_TYPES.
ALL_DOCUMENT_TYPES: tuple[str, ...] = (
    DocumentType.USER_AGREEMENT.value,
    DocumentType.PUBLIC_OFFER.value,
    DocumentType.PRIVACY_POLICY.value,
    DocumentType.DATA_PROCESSING_CONSENT.value,
    DocumentType.MARKETING_CONSENT.value,
    DocumentType.IMAGE_CONSENT.value,
    DocumentType.COOKIE_POLICY.value,
    DocumentType.DISTRIBUTION_CONSENT.value,
    DocumentType.CROSS_BORDER_CONSENT.value,
)

# Документы «уровня анкеты» — относятся к конкретному Актёру, а не к
# владельцу аккаунта, поэтому фиксируются на actor_profile_id, а не на
# user_id. Собираются в двух местах (см. actor_profiles.service):
#  - публичный экран /confirm-authority/{token} — когда Анкету создал Агент
#    и у Актёра (или его представителя) может не быть аккаунта;
#  - создание Анкеты несовершеннолетнего его законным представителем из
#    своего аккаунта — MINOR_REPRESENTATIVE_CONSENT.
PROFILE_DOCUMENT_TYPES: tuple[str, ...] = (
    DocumentType.AGENT_AUTHORITY_CONSENT.value,
    DocumentType.MINOR_REPRESENTATIVE_CONSENT.value,
)

# Документы, обязательные к акцепту ПРИ РЕГИСТРАЦИИ/входе — именно они
# блокируют доступ к интерфейсу через legal-consent-gate, пока не приняты.
# Согласие на трансграничную передачу обязательно для всех ролей — перенос
# данных в Railway/Resend/Telegram происходит фактически сразу при
# регистрации (см. CROSS_BORDER_CONSENT-content.ts, «до передачи»).
# Роли из users.enums.Roles / ModelRoles.
_BASE_REQUIRED = (
    DocumentType.USER_AGREEMENT.value,
    DocumentType.PRIVACY_POLICY.value,
    DocumentType.DATA_PROCESSING_CONSENT.value,
    DocumentType.CROSS_BORDER_CONSENT.value,
)

# Документы про оплату и подписку. Пока платные тарифы не запущены, требовать
# акцепт условий платного доступа не нужно: человек соглашался бы с ценами и
# автопродлением, которых на Платформе нет. Текст документа, его версия и
# публичная страница сохранены — чтобы вернуть требование при запуске оплаты,
# достаточно поставить True здесь и в
# frontend/apps/tma/src/shared/legal/payment-documents.ts.
PAYMENT_DOCUMENTS_ENABLED = False

PAYMENT_DOCUMENT_TYPES: tuple[str, ...] = (DocumentType.PUBLIC_OFFER.value,)

_ADMIN_REQUIRED = _BASE_REQUIRED + (
    PAYMENT_DOCUMENT_TYPES if PAYMENT_DOCUMENTS_ENABLED else ()
)

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
# конкретного действия — загрузка фото/видео Анкеты Актёра (IMAGE_CONSENT)
# либо создание/публикация Анкеты для Каст-листов (DISTRIBUTION_CONSENT,
# детальная форма с перечнем категорий данных — см. фронтенд
# cabinet/profile/create и cabinet/profile/[id]/media).
CONTEXTUAL_DOCUMENT_TYPES: tuple[str, ...] = (
    DocumentType.IMAGE_CONSENT.value,
    DocumentType.DISTRIBUTION_CONSENT.value,
)

# Информационные документы: публикуются и доступны по ссылке, но не требуют
# отдельного чек-бокса (на дату редакции используются только строго
# необходимые cookie — см. Политику использования файлов cookie).
INFORMATIONAL_DOCUMENT_TYPES: tuple[str, ...] = (DocumentType.COOKIE_POLICY.value,)

# Категории персональных данных для детальной формы согласия на
# распространение (см. 05_Согласие_на_распространение_персональных_данных) —
# по инструкции нельзя заменять одним общим чек-боксом, у каждой категории
# должен быть отдельный переключатель (по умолчанию включены все).
DISTRIBUTION_CATEGORIES: tuple[tuple[str, str], ...] = (
    ("full_name", "Ф.И.О. / отображаемое имя"),
    ("gender", "Пол"),
    ("birth_date", "Дата рождения / возраст"),
    ("location", "Город и станция метро"),
    ("professional", "Профессиональная категория, опыт, навыки, портфолио"),
    ("appearance", "Тип внешности и сведения «о себе»"),
    ("measurements", "Рост, размеры одежды и обуви, параметры тела"),
    ("photos", "Фотографии"),
    ("video", "Видеовизитка / ссылка на видео"),
    ("review_status", "Статус рассмотрения в Каст-листе"),
    ("contacts", "Телефон, e-mail, Telegram"),
)
DISTRIBUTION_CATEGORY_KEYS: tuple[str, ...] = tuple(k for k, _ in DISTRIBUTION_CATEGORIES)


def required_documents_for_role(role: str | None) -> tuple[str, ...]:
    """Документы, обязательные к акцепту при регистрации/входе для данной роли."""
    return ROLE_REQUIRED_DOCUMENTS.get(role or "", _BASE_REQUIRED)
