"""
Role-Based Access Control — Permission Matrix.

Owner (Super-Admin) — полный доступ, включая HARD_DELETE.
Administrator        — управление пользователями, кастингами, отчётами. Только SOFT_DELETE.
Manager              — управление кастингами и актёрами. Только SOFT_DELETE.
Producer             — просмотр отчётов и шорт-листов.
User (Actor)         — управление собственным профилем.
"""
import enum
from typing import Set, Dict
from users.enums import Roles


class Permission(str, enum.Enum):
    # Users
    USERS_VIEW = "users:view"
    USERS_CREATE = "users:create"
    USERS_UPDATE = "users:update"
    USERS_SOFT_DELETE = "users:soft_delete"
    USERS_HARD_DELETE = "users:hard_delete"
    USERS_MANAGE_ROLES = "users:manage_roles"

    # Actor Profiles
    PROFILES_VIEW = "profiles:view"
    PROFILES_CREATE = "profiles:create"
    PROFILES_UPDATE = "profiles:update"
    PROFILES_SOFT_DELETE = "profiles:soft_delete"
    PROFILES_HARD_DELETE = "profiles:hard_delete"
    PROFILES_VIEW_INTERNAL = "profiles:view_internal"

    # Castings
    CASTINGS_VIEW = "castings:view"
    CASTINGS_CREATE = "castings:create"
    CASTINGS_UPDATE = "castings:update"
    CASTINGS_SOFT_DELETE = "castings:soft_delete"
    CASTINGS_HARD_DELETE = "castings:hard_delete"
    CASTINGS_PUBLISH = "castings:publish"

    # Reports / Shortlists
    REPORTS_VIEW = "reports:view"
    REPORTS_CREATE = "reports:create"
    REPORTS_UPDATE = "reports:update"
    REPORTS_SOFT_DELETE = "reports:soft_delete"
    REPORTS_HARD_DELETE = "reports:hard_delete"
    REPORTS_SHARE = "reports:share"

    # Media
    MEDIA_UPLOAD = "media:upload"
    MEDIA_DELETE = "media:delete"

    # Responses (actor applications)
    RESPONSES_VIEW_OWN = "responses:view_own"
    RESPONSES_CREATE = "responses:create"
    RESPONSES_VIEW_PROJECT = "responses:view_project"

    # System
    SYSTEM_ADMIN = "system:admin"


# ─── Permission matrix per role ───
ROLE_PERMISSIONS: Dict[str, Set[Permission]] = {
    Roles.owner.value: {p for p in Permission},  # Всё, включая HARD_DELETE

    Roles.administrator.value: {
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_UPDATE,
        Permission.USERS_SOFT_DELETE,
        Permission.USERS_MANAGE_ROLES,
        Permission.PROFILES_VIEW,
        Permission.PROFILES_CREATE,
        Permission.PROFILES_UPDATE,
        Permission.PROFILES_SOFT_DELETE,
        Permission.PROFILES_VIEW_INTERNAL,
        Permission.CASTINGS_VIEW,
        Permission.CASTINGS_CREATE,
        Permission.CASTINGS_UPDATE,
        Permission.CASTINGS_SOFT_DELETE,
        Permission.CASTINGS_PUBLISH,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_CREATE,
        Permission.REPORTS_UPDATE,
        Permission.REPORTS_SOFT_DELETE,
        Permission.REPORTS_SHARE,
        Permission.MEDIA_UPLOAD,
        Permission.MEDIA_DELETE,
    },

    Roles.manager.value: {
        Permission.PROFILES_VIEW,
        Permission.PROFILES_UPDATE,
        Permission.PROFILES_SOFT_DELETE,
        Permission.CASTINGS_VIEW,
        Permission.CASTINGS_CREATE,
        Permission.CASTINGS_UPDATE,
        Permission.CASTINGS_SOFT_DELETE,
        Permission.CASTINGS_PUBLISH,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_CREATE,
        Permission.REPORTS_UPDATE,
        Permission.REPORTS_SHARE,
        Permission.MEDIA_UPLOAD,
        Permission.MEDIA_DELETE,
    },

    Roles.producer.value: {
        Permission.PROFILES_VIEW,
        Permission.CASTINGS_VIEW,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_CREATE,
        Permission.REPORTS_SHARE,
    },

    Roles.employer_pro.value: {
        # АдминПРО: кастинги + ВСЕ актёры + шорт-листы
        # НЕ может: удалять/редактировать профили, назначать админов
        Permission.CASTINGS_VIEW,
        Permission.CASTINGS_CREATE,
        Permission.CASTINGS_UPDATE,
        Permission.CASTINGS_SOFT_DELETE,
        Permission.CASTINGS_PUBLISH,
        Permission.PROFILES_VIEW,
        Permission.RESPONSES_VIEW_PROJECT,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_CREATE,
        Permission.REPORTS_UPDATE,
        Permission.REPORTS_SHARE,
    },

    Roles.employer.value: {
        # Админ: кастинги + только откликнувшиеся актёры
        Permission.CASTINGS_VIEW,
        Permission.CASTINGS_CREATE,
        Permission.CASTINGS_UPDATE,
        Permission.CASTINGS_SOFT_DELETE,
        Permission.CASTINGS_PUBLISH,
        Permission.PROFILES_VIEW,
        Permission.RESPONSES_VIEW_PROJECT,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_CREATE,
        Permission.REPORTS_SHARE,
    },

    Roles.user.value: {
        # Actor: own profile + browse castings + respond
        Permission.PROFILES_VIEW,
        Permission.PROFILES_CREATE,
        Permission.PROFILES_UPDATE,
        Permission.CASTINGS_VIEW,
        Permission.RESPONSES_CREATE,
        Permission.RESPONSES_VIEW_OWN,
        Permission.MEDIA_UPLOAD,
        Permission.MEDIA_DELETE,
    },
}


def get_permissions_for_role(role: str) -> Set[Permission]:
    return ROLE_PERMISSIONS.get(role, set())


def has_permission(role: str, permission: Permission) -> bool:
    return permission in get_permissions_for_role(role)


