from shared.services.google.drive.commands.file import DeleteFile, CreateFile
from shared.services.google.drive.commands.permissions import GooglePermissionsCommand, PermissionType, PermissionRole
from shared.services.google.sheets.commands.data.update import UpdateSheetCommand
from shared.services.google.sheets.client import sheets_client
from shared.services.google.drive.client import drive_client
from shared.services.google.enums import GoogleFilesTypeEnum
from shared.services.google.sheets.commands.data.types import *
from pydantic import HttpUrl
from typing import Tuple, Optional
from googleapiclient.errors import HttpError
from config import  settings

class GenerateStyleReportService:
    pass

class GenerateReportService:
    DIR_ID: str = '1wQUe3lS-0EPFqo1DsGNPoXu3Za4XwSN6'

    @classmethod
    def generate_report(cls, report_name: str, report_data: SheetData) -> Tuple[HttpUrl, str]:
        sheet_id = CreateFile(
            client=drive_client,
            file_type=GoogleFilesTypeEnum.SHEET,
            name=report_name,
            dir_id=cls.DIR_ID
        ).execute()

        GooglePermissionsCommand(
            client=drive_client,
            file_id=sheet_id,
            permission_type=PermissionType.ANYONE,
            role_type=PermissionRole.WRITER,
        ).execute()

        UpdateSheetCommand(
            sheet_id=sheet_id,
            client=sheets_client,
            data_chunk=report_data
        ).execute(header_row_size=70, col_size=228, row_size=331, merge_range_col_row=((0, 1), (2, 5)))

        return HttpUrl(url=f'https://docs.google.com/spreadsheets/d/{sheet_id}'), sheet_id

    @classmethod
    def delete_report(cls, sheet_id) -> None:
        try:
            DeleteFile(
                client=drive_client,
                file_id=sheet_id,
            ).execute()
        except HttpError as err:
            if err.status_code == 404:
                if settings.MODE != "PROD":
                    return
                else:
                    raise
            else:
                raise err



