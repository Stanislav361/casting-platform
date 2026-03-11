"""
RBAC Decorators — для защиты эндпоинтов на уровне роли/permissions.
"""
from functools import wraps
from typing import Union, List
from fastapi import HTTPException, status
from users.enums import Roles
from rbac.permissions import Permission, has_permission


def require_role(*allowed_roles: Roles):
    """
    Декоратор: требует, чтобы пользователь имел одну из указанных ролей.

    Usage:
        @require_role(Roles.owner, Roles.administrator)
        async def delete_user(..., authorized: JWT):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            authorized = kwargs.get('authorized')
            if not authorized:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"message": "Authentication required"}
                )
            user_role = Roles(authorized.role)
            if user_role not in allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "message": "Insufficient permissions",
                        "required_roles": [r.value for r in allowed_roles],
                        "user_role": user_role.value,
                    }
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator


def require_permission(*permissions: Permission):
    """
    Декоратор: требует набор конкретных permissions.

    Usage:
        @require_permission(Permission.USERS_HARD_DELETE)
        async def hard_delete_user(..., authorized: JWT):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            authorized = kwargs.get('authorized')
            if not authorized:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"message": "Authentication required"}
                )
            user_role = authorized.role
            missing = [
                p.value for p in permissions
                if not has_permission(user_role, p)
            ]
            if missing:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "message": "Insufficient permissions",
                        "missing_permissions": missing,
                    }
                )
            return await func(*args, **kwargs)
        return wrapper
    return decorator


