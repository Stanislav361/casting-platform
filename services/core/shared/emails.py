"""Email, который человек вводит руками.

Здесь два отдельных правила, и путать их нельзя.

**На входе** email проверяем строго: опечатка вроде пропущенного «@» должна быть
поймана сразу и объяснена по-русски. Стандартное сообщение pydantic — на
английском и про «@-sign», человеку оно ничего не говорит.

**На выходе** email не проверяем никогда. В базе, перенесённой из старой
системы, лежат адреса, которые эту проверку не проходят: у одного аккаунта email
сохранён вообще без «@». Пока схема ответа требовала валидный адрес, такая
запись превращалась в полную блокировку человека: каждый запрос, возвращающий
его же данные (GET и PATCH /auth/v2/me/), падал с 500, и он не мог ни завести
анкету, ни исправить сам email. Одна плохая строка в базе не должна выключать
человеку приложение — поэтому в схемах ответов email это просто строка, которую
мы показываем как есть, чтобы человек увидел её и поправил.
"""

from typing import Annotated, Optional

from pydantic import BeforeValidator, EmailStr, TypeAdapter, ValidationError

#: Пояснение вместо английского «An email address must have an @-sign»: человек
#: должен понять, что именно поправить, не обращаясь в поддержку.
INVALID_EMAIL_MESSAGE = (
    'Проверьте email — нужен вид name@example.com. '
    'Похоже, пропущен знак @ или домен.'
)

_EMAIL_ADAPTER = TypeAdapter(EmailStr)


def normalize_optional_email(value: object) -> Optional[str]:
    """Привести введённый email к единому виду или объяснить, что в нём не так.

    Пустое значение — это «не указан», а не ошибка: email во многих формах
    необязателен, и пустая строка из формы не должна превращаться в отказ.
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return str(_EMAIL_ADAPTER.validate_python(text)).lower()
    except ValidationError:
        raise ValueError(INVALID_EMAIL_MESSAGE) from None


#: Необязательный email во входящих схемах: проверенный и приведённый к нижнему
#: регистру. В схемах ответов используйте обычный `Optional[str]` — почему, см.
#: описание модуля.
OptionalContactEmail = Annotated[Optional[str], BeforeValidator(normalize_optional_email)]
