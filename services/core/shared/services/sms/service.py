import httpx

from config import settings


class SMSDeliveryError(Exception):
    pass


class SMSDeliveryService:
    @staticmethod
    def is_configured() -> bool:
        provider = (settings.SMS_PROVIDER or "none").strip().lower()
        if provider == "smsru":
            return bool(settings.SMSRU_API_ID)
        return False

    @staticmethod
    def build_otp_message(code: str) -> str:
        template = settings.SMS_OTP_TEMPLATE or "Код входа prostoprobuy: {code}"
        try:
            return template.format(code=code)
        except Exception:
            return f"Код входа prostoprobuy: {code}"

    @staticmethod
    def build_notification_message(title: str, message: str | None = None) -> str:
        base = title.strip() if title else "Уведомление о кастинге"
        extra = (message or "").strip()
        text = f"{base}. {extra}" if extra else base
        return text[:300]

    @classmethod
    async def send_otp_code(cls, phone: str, code: str) -> None:
        provider = (settings.SMS_PROVIDER or "none").strip().lower()
        if provider == "smsru":
            await cls._send_with_smsru(phone=phone, code=code)
            return
        raise SMSDeliveryError("SMS provider is not configured")

    @classmethod
    async def send_message(cls, phone: str, message: str) -> None:
        provider = (settings.SMS_PROVIDER or "none").strip().lower()
        if provider == "smsru":
            await cls._send_with_smsru_message(phone=phone, message=message)
            return
        raise SMSDeliveryError("SMS provider is not configured")

    @classmethod
    async def _send_with_smsru(cls, phone: str, code: str) -> None:
        if not settings.SMSRU_API_ID:
            raise SMSDeliveryError("SMSRU_API_ID is not configured")

        payload = {
            "api_id": settings.SMSRU_API_ID,
            "to": phone,
            "msg": cls.build_otp_message(code),
            "json": 1,
        }
        if settings.SMSRU_FROM:
            payload["from"] = settings.SMSRU_FROM
        await cls._send_smsru_payload(phone=phone, payload=payload)

    @classmethod
    async def _send_with_smsru_message(cls, phone: str, message: str) -> None:
        if not settings.SMSRU_API_ID:
            raise SMSDeliveryError("SMSRU_API_ID is not configured")

        payload = {
            "api_id": settings.SMSRU_API_ID,
            "to": phone,
            "msg": message,
            "json": 1,
        }
        if settings.SMSRU_FROM:
            payload["from"] = settings.SMSRU_FROM

        await cls._send_smsru_payload(phone=phone, payload=payload)

    @staticmethod
    async def _send_smsru_payload(phone: str, payload: dict) -> None:

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post("https://sms.ru/sms/send", data=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPError as exc:
            raise SMSDeliveryError(f"Failed to reach SMS provider: {exc}") from exc
        except ValueError as exc:
            raise SMSDeliveryError("SMS provider returned invalid response") from exc

        if data.get("status") != "OK":
            status_text = data.get("status_text") or "Unknown SMS provider error"
            raise SMSDeliveryError(status_text)

        sms_result = (data.get("sms") or {}).get(phone) or {}
        if sms_result.get("status") != "OK":
            status_text = sms_result.get("status_text") or "SMS was rejected by provider"
            raise SMSDeliveryError(status_text)
