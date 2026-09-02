"""Проверка, что аккаунт, на который выписан токен, ещё существует.

Access-токен самодостаточен (JWT), а refresh-cookie живёт до года, поэтому
после удаления аккаунта клиент продолжал считать себя авторизованным:
приложение открывалось, экраны читались (запросы на чтение просто ничего не
находили), а любая запись падала с 500 — нарушение внешнего ключа на `users`.
Так, например, ломался экран принятия документов: «Не удалось сохранить
согласие» на каждой попытке.

Здесь единая точка проверки для авторизации запросов и обновления токена:
удалённый аккаунт получает 401 и клиент штатно уходит на экран входа.
"""
from typing import Optional

from fastapi import HTTPException, status

ACCOUNT_DELETED_DETAIL = {
    "event": "account_deleted",
    "message": "Аккаунт удалён. Войдите заново или зарегистрируйтесь.",
}
ACCOUNT_BLOCKED_DETAIL = "Ваш аккаунт заблокирован. Обратитесь к администратору."


def account_deleted_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=ACCOUNT_DELETED_DETAIL,
    )


async def find_account(user_id) -> Optional[object]:
    """Пользователь из токена или None, если аккаунта больше нет."""
    from postgres.database import async_session_maker
    from users.models import User

    try:
        pk = int(user_id)
    except (TypeError, ValueError):
        return None

    async with async_session_maker() as session:
        user = await session.get(User, pk)

    if user is None or getattr(user, 'is_deleted', False):
        return None
    return user


async def load_active_account(user_id):
    """Пользователь из токена: 401 — аккаунта нет, 403 — заблокирован."""
    user = await find_account(user_id)
    if user is None:
        raise account_deleted_error()
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=ACCOUNT_BLOCKED_DETAIL,
        )
    return user
