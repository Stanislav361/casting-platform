from enum import StrEnum

class GoogleFilesTypeEnum(StrEnum):
    SHEET = 'application/vnd.google-apps.spreadsheet'
    DOC = 'application/vnd.google-apps.document'

class PermissionType(StrEnum):
    USER = "user"
    GROUP = "group"
    DOMAIN = "domain"
    ANYONE = "anyone"

class PermissionRole(StrEnum):
    OWNER = "owner"
    ORGANIZER = "organizer"
    FILE_ORGANIZER = "fileOrganizer"
    WRITER = "writer"
    COMMENTER = "commenter"
    READER = "reader"