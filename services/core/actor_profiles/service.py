"""
Actor Profile Service — бизнес-логика.
"""
import math
import secrets
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import HTTPException, status

from actor_profiles.repository import ActorProfileRepository
from actor_profiles.schemas import (
    SActorProfileCreate,
    SActorProfileUpdate,
    SActorProfileData,
    SActorProfileList,
    SActorProfileListItem,
    SActorProfileSwitchList,
    SActorAuthorityInfo,
    SMediaAsset,
)
from users.services.auth_token.types.jwt import JWT
from users.enums import Roles, DeleteType
from shared.schemas.base import SListMeta
from postgres.database import async_session_maker
from legal.documents import DocumentType, DISTRIBUTION_CATEGORY_KEYS
from legal.service import LegalConsentService


REQUIRED_PHOTO_CATEGORIES = ('portrait', 'profile', 'full_height')
_PHOTO_LABELS = {'portrait': 'Портрет', 'profile': 'Профиль', 'full_height': 'Полный рост'}

# Физические параметры, по которым кастинг-директор подбирает актёра. Без них
# карточка отклика приходит с пустой строкой параметров и работать с ней нельзя,
# поэтому они обязательны и при создании, и при сохранении анкеты — и стереть их
# повторным сохранением тоже нельзя.
REQUIRED_MEASUREMENT_FIELDS: tuple[tuple[str, str], ...] = (
    ('height', 'Рост'),
    ('clothing_size', 'Размер одежды'),
    ('shoe_size', 'Размер обуви'),
)

# Текстовые поля анкеты, без которых она не считается заполненной.
_REQUIRED_IDENTITY_FIELDS: tuple[tuple[str, str], ...] = (
    ('first_name', 'Имя'),
    ('gender', 'Пол'),
    ('city', 'Город'),
)

# Мессенджеры живут в аккаунте пользователя (users), а не в анкете: у одного
# аккаунта может быть несколько анкет, но контакт для связи один. `telegram_username`
# заполняется автоматически при входе через Telegram и тоже считается контактом.
_MESSENGER_FIELDS = ('telegram_nick', 'telegram_username', 'vk_nick', 'max_nick')


def _is_blank(value) -> bool:
    """Пусто ли значение обязательного поля.

    Рост приходит числом, размеры — строкой; ноль и пробелы считаем незаполненным.
    """
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (int, float)):
        return value <= 0
    return False


def _is_minor(date_of_birth) -> bool:
    if not date_of_birth:
        return False
    today = datetime.now(timezone.utc).date()
    dob = date_of_birth.date() if hasattr(date_of_birth, 'date') else date_of_birth
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return age < 18


def compute_profile_readiness(p) -> tuple[str, str, list]:
    """Единая логика «готовности» анкеты актёра.

    Анкета считается полностью заполненной (`ready`), когда указаны имя, пол,
    город, рост, размер одежды и обуви и загружены все обязательные фото
    (портрет, профиль, полный рост). Возвращает кортеж
    (readiness, readiness_label, missing).

    Используется и для отображения статуса в списках, и как защита на бэкенде
    при отклике — чтобы нельзя было откликнуться с пустой/неполной анкетой.

    Анкета, созданная Агентом, дополнительно не считается готовой, пока
    Актёр (или его законный представитель) не подтвердил полномочия Агента
    по ссылке — см. «Комплект по ролям» в инструкции по внедрению документов:
    «Агент создает Анкету: подтверждение полномочий... до публикации Анкеты».
    """
    if getattr(p, 'authority_status', 'confirmed') == 'pending_confirmation':
        return 'pending_authority', 'Ждёт подтверждения актёром', ['Подтверждение полномочий агента']

    all_photos = [m for m in (p.media_assets or []) if m.file_type == 'photo']
    photo_categories = {m.photo_category for m in all_photos if m.photo_category}
    has_required = set(REQUIRED_PHOTO_CATEGORIES).issubset(photo_categories)

    missing: list = []
    for field, label in (*_REQUIRED_IDENTITY_FIELDS, *REQUIRED_MEASUREMENT_FIELDS):
        if _is_blank(getattr(p, field, None)):
            missing.append(label)
    if not has_required:
        need = set(REQUIRED_PHOTO_CATEGORIES) - photo_categories
        for cat in REQUIRED_PHOTO_CATEGORIES:
            if cat in need:
                missing.append(f'Фото: {_PHOTO_LABELS[cat]}')

    if not missing:
        return 'ready', 'Готов к кастингам', missing
    if has_required and missing:
        return 'almost', 'Почти готов', missing
    if len(all_photos) > 0:
        return 'needs_photos', 'Не хватает фото', missing
    return 'incomplete', 'Нужно заполнить', missing


class ActorProfileService:

    @staticmethod
    def _require_measurements(payload: dict, *, partial: bool) -> None:
        """Не дать сохранить анкету без роста и размеров.

        При создании поля должны быть заполнены. При редактировании проверяем
        только то, что клиент действительно прислал (`partial`), — иначе PATCH
        одного поля падал бы из-за остальных, — но обнулить уже заполненные
        рост и размеры нельзя.
        """
        missing = [
            label
            for field, label in REQUIRED_MEASUREMENT_FIELDS
            if (field in payload or not partial) and _is_blank(payload.get(field))
        ]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "profile_measurements_required",
                    "message": (
                        f"Укажите обязательные параметры анкеты: {', '.join(missing)}. "
                        "По ним кастинг-директор подбирает актёров."
                    ),
                    "missing": missing,
                },
            )

    @staticmethod
    async def _ensure_messenger(user_id: int, contacts: dict) -> None:
        """Сохранить присланные способы связи в аккаунт и убедиться, что он есть.

        Контакты хранятся в аккаунте, а не в анкете: у агента это его собственные
        контакты, которые кастинг-директор видит у всех его актёров.

        Здесь же они и сохраняются — тем самым запросом, который их проверяет.
        Раньше форма отправляла контакты отдельным запросом, и любая его неудача
        (потерянная сеть, занятый другим аккаунтом ник Telegram, из-за которого
        откатывались и остальные контакты) превращалась в тупик: поля заполнены,
        а анкета не создаётся с требованием указать способ связи, и повторные
        нажатия ничего не меняли.

        Занятый ник Telegram анкету не блокирует: он просто не сохраняется, а
        остальные способы связи записываются. Отказываем только если у человека
        в итоге не осталось ни одного контакта.
        """
        from shared.contacts import (
            canonical_max,
            canonical_telegram,
            canonical_vk,
            is_real_contact,
            telegram_key,
        )
        from users.models import User
        from users.services.authentication.types.email_auth import find_user_by_telegram

        telegram_taken = False
        async with async_session_maker() as session:
            user = await session.get(User, user_id)
            if user is None:
                return

            for field, canonical in (
                ('vk_nick', canonical_vk),
                ('max_nick', canonical_max),
                ('telegram_nick', canonical_telegram),
            ):
                value = canonical(contacts.get(field))
                if not value or not is_real_contact(field, value):
                    continue
                if field == 'telegram_nick':
                    own_keys = {
                        telegram_key(user.telegram_nick),
                        telegram_key(getattr(user, 'telegram_username', None)),
                    }
                    if telegram_key(value) not in own_keys and await find_user_by_telegram(
                        session, value, exclude_id=user.id
                    ):
                        telegram_taken = True
                        continue
                setattr(user, field, value)

            has_contact = any(
                is_real_contact(field, getattr(user, field, None))
                for field in _MESSENGER_FIELDS
            )
            if has_contact:
                session.add(user)
                await session.commit()
                return

        if telegram_taken:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "messenger_required",
                    "message": (
                        "Указанный Telegram уже привязан к другому аккаунту, поэтому "
                        "мы не смогли его сохранить. Добавьте ВКонтакте или MAX — либо "
                        "войдите в тот аккаунт, к которому привязан этот Telegram."
                    ),
                },
            )

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "messenger_required",
                "message": (
                    "Укажите хотя бы один приоритетный способ связи: Telegram, MAX "
                    "или ВКонтакте — по нему с вами свяжется кастинг-директор."
                ),
            },
        )

    @classmethod
    async def create_profile(
        cls,
        user_token: JWT,
        data: SActorProfileCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> SActorProfileData:
        """
        Создать новый профиль актёра для текущего пользователя.

        Если анкету создаёт Агент, она получает статус
        `pending_confirmation` и одноразовую ссылку подтверждения — до
        подтверждения самим Актёром (или его законным представителем, если
        Актёр несовершеннолетний) анкета не публикуется (см.
        compute_profile_readiness). Актёр, создающий анкету для себя
        (самостоятельно, только 18+), подтверждения не требует.

        Анкету несовершеннолетнего можно завести двумя путями (`minor_consent`),
        в обоих Согласие законного представителя фиксируется в журнале
        согласий с привязкой к анкете, но с разной пометкой `role`, потому
        что юридически это разные ситуации:
          - 'representative' — анкету заполняет сам законный представитель
            (родитель/опекун) из своего аккаунта, `role='legal_representative'`;
          - 'self' — анкету заполняет несовершеннолетний, заявляя, что изучил
            документы вместе с законным представителем и тот не возражает,
            `role='minor_self'` (заявление самого несовершеннолетнего, а не
            подписанное согласие представителя).
        Ссылка подтверждения в обоих случаях не нужна — она нужна только
        Агенту, у которого полномочия подтверждает третье лицо.
        """
        user_id = int(user_token.id)
        payload = data.model_dump(exclude_none=True)
        # Служебные поля согласия — не колонки анкеты.
        minor_consent = payload.pop('minor_consent', None)
        legacy_representative = bool(payload.pop('minor_representative_consent', False))
        if not minor_consent and legacy_representative:
            minor_consent = 'representative'

        # Способы связи — колонки аккаунта, не анкеты (см. _ensure_messenger).
        contacts = {
            field: payload.pop(field, None)
            for field in ('telegram_nick', 'vk_nick', 'max_nick')
        }

        cls._require_measurements(payload, partial=False)
        await cls._ensure_messenger(user_id, contacts)

        try:
            creator_role = Roles(user_token.role)
        except Exception:
            creator_role = Roles.user

        is_agent = creator_role == Roles.agent
        is_minor = _is_minor(data.date_of_birth)

        if is_agent:
            payload['authority_status'] = 'pending_confirmation'
            payload['authority_confirmation_token'] = secrets.token_urlsafe(24)
        elif is_minor and not minor_consent:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": (
                        "Актёру меньше 18 лет. Подтвердите согласие законного "
                        "представителя — лично или указав, что документы изучены "
                        "вместе с ним."
                    )
                },
            )

        profile = await ActorProfileRepository.create_profile(
            user_id=user_id,
            data=payload,
        )

        if not is_agent and is_minor:
            await LegalConsentService.record_profile_consent(
                actor_profile_id=profile.id,
                documents=[DocumentType.MINOR_REPRESENTATIVE_CONSENT.value],
                ip_address=ip_address,
                user_agent=user_agent,
                role=(
                    'legal_representative'
                    if minor_consent == 'representative'
                    else 'minor_self'
                ),
            )

        return SActorProfileData.model_validate(profile)

    @classmethod
    async def get_authority_info(cls, token: str) -> SActorAuthorityInfo:
        """
        Публичная информация для экрана подтверждения полномочий Агента —
        по одноразовой ссылке, без авторизации (её открывает Актёр или его
        законный представитель, у которых может не быть аккаунта).
        """
        profile = await ActorProfileRepository.get_profile_by_authority_token(token=token)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Ссылка недействительна или уже использована"},
            )

        agent_name = None
        async with async_session_maker() as session:
            from users.models import User
            owner = await session.get(User, profile.user_id)
            if owner:
                name_parts = [p for p in [owner.first_name, owner.last_name] if p]
                agent_name = " ".join(name_parts) if name_parts else (owner.email or "Агент")

        already_confirmed = profile.authority_status != 'pending_confirmation'
        return SActorAuthorityInfo(
            profile_id=profile.id,
            first_name=profile.first_name,
            last_name=profile.last_name,
            is_minor=_is_minor(profile.date_of_birth),
            agent_name=agent_name,
            already_confirmed=already_confirmed,
        )

    @classmethod
    async def confirm_authority(
        cls,
        token: str,
        accept_cross_border: bool = False,
        accept_image: bool = False,
        distribution_categories: Optional[List[str]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> SActorAuthorityInfo:
        """
        Подтвердить полномочия Агента по ссылке (см. get_authority_info).

        Помимо самого подтверждения полномочий — Согласия Актёра на
        обработку данных Агентом (AGENT_AUTHORITY_CONSENT) для взрослых
        либо Согласия законного представителя несовершеннолетнего
        (MINOR_REPRESENTATIVE_CONSENT) — на этом же экране собираются
        относящиеся лично к Актёру согласия, которые Агент не может дать
        за него: трансграничная передача и использование изображения
        (оба обязательны для подтверждения), а также детальный выбор
        категорий для распространения персональных данных (Каст-листы).
        Все фиксируются в legal_consents с привязкой к actor_profile_id
        (см. legal.service.LegalConsentService.record_profile_consent).
        """
        if not accept_cross_border or not accept_image:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"message": "Необходимо принять согласие на трансграничную передачу и использование изображения"},
            )

        profile = await ActorProfileRepository.get_profile_by_authority_token(token=token)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Ссылка недействительна или уже использована"},
            )

        is_minor = _is_minor(profile.date_of_birth)
        primary_doc = (
            DocumentType.MINOR_REPRESENTATIVE_CONSENT.value
            if is_minor
            else DocumentType.AGENT_AUTHORITY_CONSENT.value
        )

        categories = [c for c in (distribution_categories or []) if c in DISTRIBUTION_CATEGORY_KEYS]
        if not categories:
            categories = list(DISTRIBUTION_CATEGORY_KEYS)

        await LegalConsentService.record_profile_consent(
            actor_profile_id=profile.id,
            documents=[
                primary_doc,
                DocumentType.CROSS_BORDER_CONSENT.value,
                DocumentType.IMAGE_CONSENT.value,
                DocumentType.DISTRIBUTION_CONSENT.value,
            ],
            ip_address=ip_address,
            user_agent=user_agent,
            categories={DocumentType.DISTRIBUTION_CONSENT.value: categories},
        )

        confirmed_profile = await ActorProfileRepository.confirm_authority_by_token(token=token)
        if not confirmed_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Ссылка недействительна или уже использована"},
            )
        return SActorAuthorityInfo(
            profile_id=confirmed_profile.id,
            first_name=confirmed_profile.first_name,
            last_name=confirmed_profile.last_name,
            is_minor=is_minor,
            agent_name=None,
            already_confirmed=True,
        )

    @classmethod
    async def get_profile(cls, profile_id: int, user_token: Optional[JWT] = None) -> SActorProfileData:
        """Получить профиль по ID.
        - Контакты скрыты если пользователь забанен.
        - Если владелец — агент, показываем контакты агента вместо профильных.
        """
        profile = await ActorProfileRepository.get_profile_by_id(profile_id=profile_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Actor profile not found"}
            )
        data = SActorProfileData.model_validate(profile)

        is_own = user_token and int(user_token.id) == profile.user_id
        if not is_own:
            # Ссылка подтверждения полномочий — секрет, её нельзя светить
            # никому кроме владельца (агента, создавшего анкету) и админов.
            data.authority_confirmation_token = None
        if user_token:
            try:
                user_role = Roles(user_token.role)
            except Exception:
                user_role = Roles.user
            if not is_own and not user_role.can_manage_castings:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "You don't have permission to view this profile"}
                )
        from users.models import User
        async with async_session_maker() as session:
            owner = await session.get(User, profile.user_id)
            if owner:
                if not owner.is_active:
                    data.phone_number = None
                    data.email = None
                elif owner.role and str(owner.role.value if hasattr(owner.role, 'value') else owner.role) == 'agent':
                    # Контакты актёра-клиента агента заменяем на контакты самого агента
                    name_parts = [p for p in [owner.first_name, owner.last_name] if p]
                    data.has_agent = True
                    data.agent_name = " ".join(name_parts) if name_parts else (owner.email or "Агент")
                    data.phone_number = owner.phone_number
                    data.email = owner.email

        return data

    @classmethod
    async def get_my_profiles(cls, user_token: JWT) -> SActorProfileSwitchList:
        """
        Получить все профили текущего пользователя.
        Используется для Switch Profile UI.
        """
        user_id = int(user_token.id)
        current_profile_id = int(user_token.profile_id) if user_token.profile_id else None

        profiles = await ActorProfileRepository.get_profiles_by_user(user_id=user_id)
        profile_items = [cls._build_list_item(p) for p in profiles]

        return SActorProfileSwitchList(
            profiles=profile_items,
            current_profile_id=current_profile_id,
        )

    @staticmethod
    def _build_list_item(p) -> SActorProfileListItem:
        primary_photo = None
        all_photos = [m for m in (p.media_assets or []) if m.file_type == 'photo']
        if all_photos:
            primary_assets = [m for m in all_photos if m.is_primary]
            if primary_assets:
                primary_photo = primary_assets[0].processed_url or primary_assets[0].original_url
            else:
                primary_photo = all_photos[0].processed_url or all_photos[0].original_url

        photo_categories = {m.photo_category for m in all_photos if m.photo_category}
        has_required = set(REQUIRED_PHOTO_CATEGORIES).issubset(photo_categories)

        readiness, readiness_label, missing = compute_profile_readiness(p)

        from datetime import date as date_type
        age = None
        if p.date_of_birth:
            today = date_type.today()
            age = today.year - p.date_of_birth.year - (
                (today.month, today.day) < (p.date_of_birth.month, p.date_of_birth.day)
            )

        return SActorProfileListItem(
            id=p.id,
            display_name=p.display_name,
            first_name=p.first_name,
            last_name=p.last_name,
            gender=p.gender,
            date_of_birth=p.date_of_birth,
            age=age,
            city=p.city,
            metro_station=p.metro_station,
            tax_status=p.tax_status,
            qualification=p.qualification,
            height=int(p.height) if p.height else None,
            clothing_size=str(p.clothing_size).rstrip('0').rstrip('.') if p.clothing_size else None,
            shoe_size=str(p.shoe_size).rstrip('0').rstrip('.') if p.shoe_size else None,
            is_active=p.is_active,
            primary_photo=primary_photo,
            photo_count=len(all_photos),
            has_required_photos=has_required,
            readiness=readiness,
            readiness_label=readiness_label,
            missing=missing,
            authority_status=getattr(p, 'authority_status', 'confirmed') or 'confirmed',
            authority_confirmation_token=getattr(p, 'authority_confirmation_token', None),
        )

    @classmethod
    async def update_profile(
        cls,
        profile_id: int,
        data: SActorProfileUpdate,
        user_token: JWT,
    ) -> SActorProfileData:
        """Обновить профиль актёра."""
        user_id = int(user_token.id)
        user_role = Roles(user_token.role)

        # Проверяем ownership или роль
        is_owner = await ActorProfileRepository.check_profile_ownership(
            profile_id=profile_id, user_id=user_id,
        )
        if not is_owner and not user_role.can_manage_castings:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"message": "You don't have permission to edit this profile"}
            )

        # Keep explicit nulls so optional media links can be cleared.
        payload = data.model_dump(exclude_unset=True)
        cls._require_measurements(payload, partial=True)

        profile = await ActorProfileRepository.update_profile(
            profile_id=profile_id,
            data=payload,
        )
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"message": "Actor profile not found"}
            )
        return SActorProfileData.model_validate(profile)

    @classmethod
    async def delete_own_profile(cls, profile_id: int, user_token: JWT) -> int:
        """Полностью удалить свою анкету актёра."""
        user_id = int(user_token.id)
        is_owner = await ActorProfileRepository.check_profile_ownership(
            profile_id=profile_id,
            user_id=user_id,
        )
        if not is_owner:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"message": "Profile does not belong to you"},
            )

        await ActorProfileRepository.hard_delete_profile(profile_id=profile_id)
        return status.HTTP_200_OK

    @classmethod
    async def delete_profile(
        cls,
        profile_id: int,
        user_token: JWT,
        delete_type: DeleteType = DeleteType.SOFT,
    ) -> int:
        """
        Удалить профиль.
        SOFT_DELETE — для Manager и выше.
        HARD_DELETE — только для Owner.
        """
        user_role = Roles(user_token.role)

        if delete_type == DeleteType.HARD:
            if not user_role.can_hard_delete:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Only Owner can perform hard delete"}
                )
            await ActorProfileRepository.hard_delete_profile(profile_id=profile_id)
        else:
            if not user_role.can_soft_delete:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={"message": "Insufficient permissions for delete"}
                )
            await ActorProfileRepository.soft_delete_profile(profile_id=profile_id)

        return status.HTTP_200_OK

    @classmethod
    async def get_profiles_list(
        cls,
        page_number: int,
        page_size: int,
        search: Optional[str] = None,
        metro_station: Optional[str] = None,
    ) -> SActorProfileList:
        """Список профилей с пагинацией (для admin)."""
        profiles, query = await ActorProfileRepository.get_profiles_paginated(
            page_number=page_number,
            page_size=page_size,
            search=search,
            metro_station=metro_station,
        )

        async with async_session_maker() as session:
            meta = await ActorProfileRepository.get_meta(
                session=session,
                query=query,
                page_number=page_number,
                page_size=page_size,
            )

        profile_items = [cls._build_list_item(p) for p in profiles]

        return SActorProfileList(
            meta=SListMeta(**meta),
            profiles=profile_items,
        )


