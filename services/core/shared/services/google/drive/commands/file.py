from shared.services.google.enums import GoogleFilesTypeEnum
from typing import Any
from shared.services.google.protocols import GoogleCommandsProtocol


class CreateFile(GoogleCommandsProtocol):
    def __init__(
            self,
            client: Any,
            file_type: GoogleFilesTypeEnum,
            name: str,
            dir_id: str
    ):
        self.client = client
        self.file_metadata = {
            'name': name,
            'mimeType': file_type,
            'parents': [dir_id],
        }

    def execute(self) -> str:
        file = (
            self.client
            .files()
            .create(body=self.file_metadata, fields='id')
            .execute()
        )
        return file.get('id')


class DeleteFile(GoogleCommandsProtocol):
    def __init__(
            self,
            client: Any,
            file_id: str,
    ):
        self.client = client
        self.file_id = file_id

    def execute(self) -> None:
        self.client.files().delete(fileId=self.file_id).execute()