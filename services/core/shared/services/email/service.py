import asyncio
import smtplib
from email.message import EmailMessage

from config import settings


class EmailDeliveryError(Exception):
    pass


class EmailDeliveryService:
    @staticmethod
    def is_configured() -> bool:
        return bool(
            settings.SMTP_HOST
            and settings.SMTP_PORT
            and settings.SMTP_FROM
        )

    @classmethod
    async def send_notification_email(
        cls,
        to_email: str,
        subject: str,
        message: str,
    ) -> None:
        if not cls.is_configured():
            raise EmailDeliveryError("SMTP is not configured")

        email = EmailMessage()
        email["Subject"] = subject
        email["From"] = settings.SMTP_FROM
        email["To"] = to_email
        email.set_content(message or subject)

        await asyncio.to_thread(cls._send_message, email)

    @staticmethod
    def _send_message(email: EmailMessage) -> None:
        try:
            if settings.SMTP_USE_SSL:
                with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                    if settings.SMTP_USERNAME:
                        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
                    server.send_message(email)
                return

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USERNAME:
                    server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD or "")
                server.send_message(email)
        except Exception as exc:
            raise EmailDeliveryError(f"Failed to send email: {exc}") from exc
