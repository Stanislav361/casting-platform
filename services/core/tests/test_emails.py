"""Проверка правил для email (shared/emails.py) и схем, где он встречается.

Что именно защищаем. У одного человека в перенесённой базе email сохранён без
«@» — `kolosovskiymisha1gmail.com`. Схема ответа требовала валидный адрес, и
поэтому каждый запрос за его же данными (GET и PATCH /auth/v2/me/) падал с 500:
человек не мог ни завести анкету, ни исправить сам email — приложение было для
него выключено целиком, а в интерфейсе он видел только «Server error 500».

Отсюда два правила, и оба проверяем здесь:

  * схема ответа не проверяет email никогда — что лежит в базе, то и отдаём,
    чтобы человек увидел свой адрес и поправил его;
  * схема ввода проверяет email строго, но объясняет ошибку по-русски.

Запуск (pytest не нужен):

    cd services/core && ./.venv/bin/python tests/test_emails.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pydantic import BaseModel, ValidationError  # noqa: E402

from shared.emails import (  # noqa: E402
    INVALID_EMAIL_MESSAGE,
    OptionalContactEmail,
    normalize_optional_email,
)

#: Реальные значения из логов, каждое заблокировало живого человека. Оба попали
#: в базу через POST /auth/v2/change-email/, которая записывала адрес без всякой
#: проверки: «j» — явно недописанный адрес, второй — с пропущенным «@».
BROKEN_EMAILS = ['kolosovskiymisha1gmail.com', 'j']
BROKEN_EMAIL = BROKEN_EMAILS[0]

failures: list[str] = []


def check(title: str, condition: bool) -> None:
    if not condition:
        failures.append(title)
    print(f"{'ok  ' if condition else 'FAIL'} {title}")


class Incoming(BaseModel):
    """Как email описан во входящих схемах."""

    email: OptionalContactEmail = None


def rejects(value: str) -> bool:
    """Отклонён ли адрес — и объяснена ли причина по-русски."""
    try:
        Incoming(email=value)
    except ValidationError as exc:
        return INVALID_EMAIL_MESSAGE in str(exc)
    return False


def main() -> int:
    print('— Ввод: битый адрес отклонён с понятным объяснением —')
    for value in BROKEN_EMAILS:
        check(f'адрес из базы «{value}» больше не сохранить', rejects(value))
    check('адрес без домена не проходит', rejects('misha@'))
    check('адрес из одного слова не проходит', rejects('misha'))
    check('две «@» не проходят', rejects('a@@b.com'))
    check('пробел внутри адреса не проходит', rejects('mi sha@gmail.com'))
    check(
        'объяснение по-русски и подсказывает вид адреса',
        'name@example.com' in INVALID_EMAIL_MESSAGE and '@' in INVALID_EMAIL_MESSAGE,
    )

    print('\n— Ввод: нормальный адрес проходит и приводится к единому виду —')
    check('обычный адрес проходит', Incoming(email='misha@gmail.com').email == 'misha@gmail.com')
    check(
        'регистр и пробелы от автозамены убираются',
        Incoming(email='  Misha@GMail.COM  ').email == 'misha@gmail.com',
    )

    print('\n— Ввод: «не указан» это не ошибка —')
    # Форма присылает пустую строку для незаполненного поля. Если считать её
    # ошибкой, человек не сможет сохранить анкету без необязательного email.
    check('пустая строка = не указан', Incoming(email='').email is None)
    check('пробелы = не указан', Incoming(email='   ').email is None)
    check('None = не указан', Incoming(email=None).email is None)
    check('поле можно не присылать вовсе', Incoming().email is None)

    print('\n— Ответ: битый адрес из базы не ломает выдачу —')
    # Главная проверка. Раньше на этой строке приложение выключалось для
    # человека целиком, поэтому собираем схемы ответа так же, как их собирает
    # приложение, и убеждаемся, что адрес доходит до человека как есть.
    from users.schemas.email_auth import SCurrentUserData

    for value in BROKEN_EMAILS:
        me = SCurrentUserData(id=1, email=value, role='user')
        check(f'ответ с адресом «{value}» собирается', me.email == value)
        check(f'адрес «{value}» виден человеку и его можно поправить', me.model_dump()['email'] == value)

    from actor_profiles.schemas import SActorProfileData

    profile = SActorProfileData(id=1, user_id=1, email=BROKEN_EMAIL)
    check('SActorProfileData принимает битый адрес', profile.email == BROKEN_EMAIL)

    print('\n— Ответ: пустой email допустим —')
    check('email может отсутствовать', SCurrentUserData(id=1, role='user').email is None)

    print('\n— Тот самый путь, который падал в продакшене —')
    # В логах падало именно здесь: GET и PATCH /auth/v2/me/ собирают ответ этой
    # функцией. Подставляем аккаунт с битым адресом — доступ к атрибутам это всё,
    # что функции нужно, поэтому ORM-модель и база не требуются.
    from types import SimpleNamespace

    from users.routes.auth_v2 import _serialize_current_user

    for value in BROKEN_EMAILS:
        account = SimpleNamespace(
            id=1, email=value,
            first_name='Михаил', last_name='Колосовский', middle_name=None,
            phone_number=None, photo_url=None,
            telegram_nick='@kolosvskiy', telegram_username=None, telegram_id=None,
            vk_nick=None, max_nick=None, password_hash=None,
            casting_notification_channel='in_app', role='user',
        )
        try:
            serialized = _serialize_current_user(account)
            ok = serialized.email == value
        except Exception:
            ok = False
        check(f'/auth/v2/me/ с адресом «{value}» отвечает, а не падает с 500', ok)

    print('\n— Приведение адреса напрямую —')
    check('normalize возвращает None для пустого', normalize_optional_email('  ') is None)
    check(
        'normalize приводит к нижнему регистру',
        normalize_optional_email('Misha@Gmail.com') == 'misha@gmail.com',
    )
    try:
        normalize_optional_email(BROKEN_EMAIL)
        broken_raised = False
    except ValueError as exc:
        broken_raised = str(exc) == INVALID_EMAIL_MESSAGE
    check('normalize объясняет ошибку тем же текстом', broken_raised)

    print()
    if failures:
        print(f'Не прошло проверок: {len(failures)}')
        for title in failures:
            print(f'  - {title}')
        return 1
    print('Все проверки пройдены.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
