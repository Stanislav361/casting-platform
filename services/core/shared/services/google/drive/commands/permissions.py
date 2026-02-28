from typing import Any

from shared.services.google.protocols import GoogleCommandsProtocol
from shared.services.google.enums import PermissionType, PermissionRole


class GooglePermissionsCommand(GoogleCommandsProtocol):

    def __init__(
            self,
            client: Any,
            file_id: str,
            permission_type: PermissionType,
            role_type: PermissionRole,
    ):
        self.client = client
        self.file_id = file_id
        self.permission_type = permission_type
        self.role_type = role_type

    def execute(self, ) -> None:
        self.client.permissions().create(
            fileId=self.file_id,
            body={
                'type': self.permission_type,
                'role': self.role_type
            }
        ).execute()

