from enum import Enum

class GoogleServiceAccountScope(Enum):
    DRIVE = 'https://www.googleapis.com/auth/drive'
    SHEETS = 'https://www.googleapis.com/auth/spreadsheets'
    GMAIL = 'https://www.googleapis.com/auth/gmail.readonly'
    ...