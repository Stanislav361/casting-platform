"""
Юридически значимые документы Платформы: Пользовательское соглашение и
Публичная оферта, а также фиксация акцепта/ознакомления пользователя с их
действующей редакцией.

Таблица `legal_consents` — журнал согласий (append-only): при каждом акцепте
добавляется новая строка, старые не перезаписываются и не удаляются. Это
соответствует требованию документов о хранении технических доказательств
акцепта (см. Оферту п. «Юридически значимые сообщения» и Соглашение
п. «Электронные доказательства»): дата, время, версия документа, IP и
User-Agent сохраняются как есть на момент действия пользователя.

Ровно одно из `user_id` / `actor_profile_id` заполнено:
  - `user_id` — обычное согласие, привязанное к аккаунту (актёр, агент,
    админ), например при регистрации или загрузке фото.
  - `actor_profile_id` — согласие Актёра (или его законного представителя,
    если несовершеннолетний), у которого может не быть своего аккаунта,
    потому что Анкету создал Агент. Собирается на публичном экране
    /confirm-authority/{token} — см. actor_profiles.service.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, TIMESTAMP, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from postgres.database import Base


class LegalConsent(Base):
    """Запись об акцепте/ознакомлении пользователя с редакцией документа."""
    __tablename__ = 'legal_consents'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True)
    # Согласие Актёра/представителя без отдельного аккаунта — см. docstring выше.
    actor_profile_id = Column(Integer, ForeignKey('actor_profiles.id', ondelete='CASCADE'), nullable=True, index=True)

    # 'user_agreement' | 'public_offer' | ... (см. legal.documents.DocumentType)
    document_type = Column(String(50), nullable=False, index=True)
    # Человекочитаемая версия редакции документа на момент акцепта,
    # например "27.07.2026 №1" — совпадает с таблицей реквизитов в самом документе.
    version = Column(String(50), nullable=False)

    # Роль пользователя на момент акцепта (снимок, а не текущая роль пользователя) —
    # требование журналирования из инструкции по внедрению документов.
    role = Column(String(50), nullable=True)

    # Выбор по категориям данных для Согласия на распространение (см.
    # legal.documents.DISTRIBUTION_CATEGORIES) — список разрешённых ключей
    # категорий. Для остальных типов документов остаётся NULL.
    categories = Column(JSON, nullable=True)

    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)

    accepted_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    # Заполняется при отзыве отзываемого согласия (например, рекламная рассылка).
    # Сама запись об акцепте не удаляется и не переписывается.
    revoked_at = Column(TIMESTAMP(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
