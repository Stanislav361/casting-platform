from googleapiclient.discovery import build
from shared.services.google.credentials.service_account import GoogleServiceAccount
from shared.services.google.credentials.scopes import GoogleServiceAccountScope
from config import settings

scopes = [GoogleServiceAccountScope.SHEETS, ]

account = GoogleServiceAccount(
    scopes=scopes,
    account_auth_file_path=settings.GOOGLE_SERVICE_ACCOUNT_PATH,
    delegated_user_email=settings.GOOGLE_DELEGATE_USER
)
sheets_client = build('sheets', 'v4', credentials=account.credentials)
