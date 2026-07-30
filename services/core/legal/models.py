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
"""
from sqlalchemy import Column, Integer, String, ForeignKey, TIMESTAMP, Text
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from postgres.database import Base


class LegalConsent(Base):
    """Запись об акцепте/ознакомлении пользователя с редакцией документа."""
    __tablename__ = 'legal_consents'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)

    # 'user_agreement' | 'public_offer' (см. legal.documents.DocumentType)
    document_type = Column(String(50), nullable=False, index=True)
    # Человекочитаемая версия редакции документа на момент акцепта,
    # например "27.07.2026 №1" — совпадает с таблицей реквизитов в самом документе.
    version = Column(String(50), nullable=False)

    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)

    accepted_at = Column(TIMESTAMP(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    user = relationship("User", foreign_keys=[user_id])
