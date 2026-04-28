"""
Генерация VAPID ключевой пары для Web Push.

Использование:
    cd services/core
    python -m crm.generate_vapid

Вывод (Base64URL):
    VAPID_PUBLIC_KEY=...
    VAPID_PRIVATE_KEY=...

Затем добавьте эти переменные в файл environments/<MODE>/.env и перезапустите
сервис. VAPID_SUBJECT (mailto:...) можно не менять (значение по умолчанию).
"""
import base64
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def main() -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()

    private_number = private_key.private_numbers().private_value
    private_bytes = private_number.to_bytes(32, byteorder='big')

    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )

    print(f"VAPID_PUBLIC_KEY={_b64url(public_bytes)}")
    print(f"VAPID_PRIVATE_KEY={_b64url(private_bytes)}")


if __name__ == '__main__':
    main()
