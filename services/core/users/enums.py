import enum
from typing import Any, Dict
from functools import total_ordering


_ROLE_PRIORITY: Dict[str, int] = {
    'owner': 0,
    'administrator': 1,
    'manager': 2,
    'producer': 3,
    'employer_pro': 4,
    'employer': 5,
    'agent': 6,
    'user': 7,
}


@total_ordering
class Roles(enum.Enum):
    owner = 'owner'
    administrator = 'administrator'
    manager = 'manager'
    producer = 'producer'
    employer_pro = 'employer_pro'
    employer = 'employer'
    agent = 'agent'
    user = 'user'

    @property
    def priority(self) -> int:
        return -(_ROLE_PRIORITY[self.value])

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, Roles):
            return self.priority == other.priority
        return super().__eq__(other)

    def __lt__(self, other: Any) -> bool:
        if isinstance(other, Roles):
            return self.priority < other.priority
        return super().__lt__(other)

    def __hash__(self):
        return hash(self.value)

    # ---------- Permission helpers ----------
    @property
    def can_hard_delete(self) -> bool:
        """Only owner (super-admin) can perform hard delete."""
        return self == Roles.owner

    @property
    def can_soft_delete(self) -> bool:
        """Managers and above can perform soft delete."""
        return self.priority >= Roles.manager.priority

    @property
    def can_manage_users(self) -> bool:
        return self.priority >= Roles.administrator.priority

    @property
    def can_manage_castings(self) -> bool:
        return self.priority >= Roles.manager.priority

    @property
    def can_view_reports(self) -> bool:
        return self.priority >= Roles.producer.priority

    @property
    def can_manage_own_castings(self) -> bool:
        """Employer can manage only their own castings."""
        return self == Roles.employer or self.priority >= Roles.manager.priority

    @property
    def is_employer(self) -> bool:
        return self in (Roles.employer, Roles.employer_pro)

    @property
    def is_employer_pro(self) -> bool:
        return self == Roles.employer_pro

    @property
    def is_superadmin(self) -> bool:
        return self == Roles.owner

    @property
    def is_actor(self) -> bool:
        return self == Roles.user

    @property
    def is_agent(self) -> bool:
        return self == Roles.agent

    @property
    def can_view_all_actors(self) -> bool:
        """employer_pro видит ВСЕХ актёров, employer — только откликнувшихся."""
        return self == Roles.employer_pro or self.priority >= Roles.manager.priority


class ModelRoles(enum.Enum):
    owner = 'owner'
    administrator = 'administrator'
    manager = 'manager'
    producer = 'producer'
    employer_pro = 'employer_pro'
    employer = 'employer'
    agent = 'agent'
    user = 'user'


class SubscriptionType(enum.Enum):
    ADMIN = 'admin'
    ADMIN_PRO = 'admin_pro'


class SearchFields(enum.Enum):
    TELEGRAM_USERNAME = "telegram_username"
    FIRST_NAME = "first_name"
    LAST_NAME = "last_name"
    EMAIL = "email"


class DeleteType(enum.Enum):
    SOFT = "soft"
    HARD = "hard"
