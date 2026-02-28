from users.services.authentication.creators.admin_auth import TgAuthMethod
from users.services.authentication.creators.tma_auth import TMAAuthMethod
from fastapi import Request, Response, Header, Depends
from typing import Optional
from config import settings
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from users.services.authorization.service import AuthorizationService
from users.services.authorization.creators.administrator import AdminAuthMethod
from users.services.authorization.creators.user import UserAuthMethod

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
    return await AuthorizationService(authorization_method=AdminAuthMethod(request=request)).authorize()


async def tma_authorized(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    return await AuthorizationService(
        authorization_method=UserAuthMethod(request=request)
    ).authorize()


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
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Employer subscription required")
    return jwt
