"""Приведение способов связи (Telegram, ВКонтакте, MAX) к единому виду.

Люди пишут контакт как придётся: «@nick», «nick», «t.me/nick», «T.me/Nick»,
«https://t.me/nick», «vk.com/id5426337». Раньше значение сохранялось в аккаунт
ровно так, как его набрали, а проверка занятости сравнивала строки почти без
обработки. Отсюда росли две беды:

  * один и тот же контакт считался то занятым, то новым — в зависимости от того,
    в каком виде его набрали в этот раз (перенесённая база полна ссылок t.me);
  * кастинг-директор видел в анкете ссылку вместо ника.

Поэтому нормализация живёт здесь одна для всех: и запись контакта в аккаунт, и
сравнение на занятость идут через эти функции.
"""
from __future__ import annotations

import re
from typing import Optional

_TELEGRAM_PREFIXES = (
    'https://t.me/',
    'http://t.me/',
    'https://telegram.me/',
    'http://telegram.me/',
    't.me/',
    'telegram.me/',
)

_VK_PREFIXES = (
    'https://vk.com/',
    'http://vk.com/',
    'https://m.vk.com/',
    'http://m.vk.com/',
    'https://vk.ru/',
    'http://vk.ru/',
    'm.vk.com/',
    'vk.com/',
    'vk.ru/',
)

_MAX_PREFIXES = (
    'https://max.ru/',
    'http://max.ru/',
    'https://web.max.ru/',
    'http://web.max.ru/',
    'web.max.ru/',
    'max.ru/',
)

# Ник, к которому можно безопасно приписать «@» или «vk.com/». Всё остальное
# (кириллица, пробелы, имя с точками-запятыми) оставляем как набрали — лучше
# сохранить непонятное значение, чем изуродовать то, что человек имел в виду.
_NICK_RE = re.compile(r'^[A-Za-z0-9._-]{2,64}$')
_PHONE_RE = re.compile(r'^\+?[\d\s\-()]{5,20}$')

# Минимальная длина, при которой значение считается настоящим контактом. Один
# символ (или оставшийся от «@» пустой хвост) — это не способ связи.
_MIN_CONTACT_LENGTH = 2


def _clean(value: Optional[str], prefixes: tuple[str, ...]) -> Optional[str]:
    """Убрать ссылку, «@», лишние пробелы и хвост от параметров запроса."""
    if not value:
        return None
    text = str(value).replace('\u00a0', ' ').strip()
    text = text.split('?', 1)[0]
    lowered = text.lower()
    for prefix in prefixes:
        if lowered.startswith(prefix):
            text = text[len(prefix):]
            break
    text = text.strip().lstrip('@').strip('/').strip()
    return text or None


def _looks_like_phone(value: str) -> bool:
    return bool(_PHONE_RE.match(value))


def telegram_key(value: Optional[str]) -> Optional[str]:
    """Ключ для сравнения ников Telegram: без «@», ссылок и регистра."""
    cleaned = _clean(value, _TELEGRAM_PREFIXES)
    return cleaned.lower() if cleaned else None


def vk_key(value: Optional[str]) -> Optional[str]:
    cleaned = _clean(value, _VK_PREFIXES)
    return cleaned.lower() if cleaned else None


def max_key(value: Optional[str]) -> Optional[str]:
    cleaned = _clean(value, _MAX_PREFIXES)
    return cleaned.lower() if cleaned else None


def canonical_telegram(value: Optional[str]) -> Optional[str]:
    """Вид, в котором ник Telegram хранится и показывается: «@nick»."""
    cleaned = _clean(value, _TELEGRAM_PREFIXES)
    if not cleaned:
        return None
    if _looks_like_phone(cleaned):
        return cleaned
    return f'@{cleaned}' if _NICK_RE.match(cleaned) else cleaned


def canonical_vk(value: Optional[str]) -> Optional[str]:
    """Вид, в котором хранится ВКонтакте: «vk.com/id5426337»."""
    cleaned = _clean(value, _VK_PREFIXES)
    if not cleaned:
        return None
    return f'vk.com/{cleaned}' if _NICK_RE.match(cleaned) else cleaned


def canonical_max(value: Optional[str]) -> Optional[str]:
    """Вид, в котором хранится MAX: «@nick» либо номер телефона."""
    cleaned = _clean(value, _MAX_PREFIXES)
    if not cleaned:
        return None
    if _looks_like_phone(cleaned):
        return cleaned
    return f'@{cleaned}' if _NICK_RE.match(cleaned) else cleaned


#: Как обрабатывать каждое поле аккаунта: канонический вид и ключ сравнения.
MESSENGER_NORMALIZERS = {
    'telegram_nick': (canonical_telegram, telegram_key),
    'telegram_username': (canonical_telegram, telegram_key),
    'vk_nick': (canonical_vk, vk_key),
    'max_nick': (canonical_max, max_key),
}


def normalize_messenger(field: str, value: Optional[str]) -> Optional[str]:
    """Канонический вид значения для поля аккаунта (`telegram_nick` и т.п.)."""
    canonical, _ = MESSENGER_NORMALIZERS.get(field, (canonical_telegram, telegram_key))
    return canonical(value)


def is_real_contact(field: str, value: Optional[str]) -> bool:
    """Похоже ли значение на настоящий способ связи, а не на «@» или «-»."""
    _, key = MESSENGER_NORMALIZERS.get(field, (canonical_telegram, telegram_key))
    normalized = key(value)
    return bool(normalized) and len(normalized) >= _MIN_CONTACT_LENGTH
