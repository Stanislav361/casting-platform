from users.services.authentication.creators.admin_auth import TgAuthMethod
from users.services.authentication.creators.tma_auth import TMAAuthMethod
from fastapi import Request, Response, Header, Depends, HTTPException
from typing import Optional
from config import settings
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from users.services.authorization.service import AuthorizationService
from users.services.authorization.creators.administrator import AdminAuthMethod
from users.services.authorization.creators.user import UserAuthMethod
from users.services.account_guard import load_active_account

security = HTTPBearer()


def get_admin_authentication_method(
        request: Request,
        response: Response,
) -> TgAuthMethod:
    return TgAuthMethod(request=request, response=response)

def get_tma_authentication_method(
        request: Request,
        response: Response,
) -> TMAAuthMethod:
    return TMAAuthMethod(request=request, response=response)


async def admin_authorized(
        request: Request,
        credentials: HTTPAuthorizationCredentials = Depends(security),
):
    jwt = await AuthorizationService(
        authorization_method=AdminAuthMethod(request=request)
    ).authorize()
    await load_active_account(jwt.id)
    return jwt


async def tma_authorized(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    jwt = await AuthorizationService(
        authorization_method=UserAuthMethod(request=request)
    ).authorize()

    # Токен переживает удаление аккаунта, поэтому проверяем, что пользователь
    # ещё существует: иначе запись любых данных падала с 500 по внешнему ключу
    # на users (см. users.services.account_guard).
    await load_active_account(jwt.id)
    return jwt


async def employer_authorized(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """Авторизация для employer/employer_pro — проверяет JWT, допускает роли employer+."""
    jwt = await AuthorizationService(
        authorization_method=UserAuthMethod(request=request)
    ).authorize()
    allowed = ['owner', 'administrator', 'manager', 'employer', 'employer_pro']
    if jwt.role not in allowed:
        raise HTTPException(status_code=403, detail="Employer subscription required")

    user = await load_active_account(jwt.id)
    if jwt.role in ['employer', 'employer_pro'] and not getattr(user, 'is_employer_verified', False):
        raise HTTPException(
            status_code=403,
            detail="employer_not_verified",
        )
    return jwt
