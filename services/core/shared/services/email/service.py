import asyncio
import smtplib
from email.message import EmailMessage

import httpx

from config import settings


class EmailDeliveryError(Exception):
    pass


class EmailDeliveryService:
    @staticmethod
    def is_configured() -> bool:
        if settings.RESEND_API_KEY and (settings.EMAIL_FROM or settings.SMTP_FROM):
            return True
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
            raise EmailDeliveryError("Email provider is not configured")

        if settings.RESEND_API_KEY:
            await cls._send_with_resend(
                to_email=to_email,
                subject=subject,
                message=message,
            )
            return

        email = EmailMessage()
        email["Subject"] = subject
        email["From"] = cls._sender_email()
        email["To"] = to_email
        email.set_content(message or subject)

        await asyncio.to_thread(cls._send_message, email)

    @staticmethod
    def _sender_email() -> str:
        return settings.EMAIL_FROM or settings.SMTP_FROM or ""

    @classmethod
    async def _send_with_resend(
        cls,
        to_email: str,
        subject: str,
        message: str,
    ) -> None:
        payload = {
            "from": cls._sender_email(),
            "to": [to_email],
            "subject": subject,
            "text": message or subject,
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json=payload,
                )
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                detail = exc.response.json()
            except ValueError:
                detail = exc.response.text
            raise EmailDeliveryError(f"Resend rejected email: {detail}") from exc
        except httpx.HTTPError as exc:
            raise EmailDeliveryError(f"Failed to reach Resend: {exc}") from exc

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
