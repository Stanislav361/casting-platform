from google.oauth2 import service_account
from typing import List
from shared.services.google.credentials.scopes import GoogleServiceAccountScope
from pathlib import Path

class GoogleServiceAccount:

    def __init__(
            self,
            scopes: List[GoogleServiceAccountScope],
            account_auth_file_path: Path,
            delegated_user_email: str,
    ):
        self.scopes = [scope.value for scope in scopes]
        self.account_auth_file_path = account_auth_file_path
        self.delegated_user_email = delegated_user_email

        self.credentials = service_account.Credentials.from_service_account_file(
            filename=str(self.account_auth_file_path),
            scopes=self.scopes
        ).with_subject(self.delegated_user_email)