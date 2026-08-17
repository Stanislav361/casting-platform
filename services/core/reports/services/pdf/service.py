"""Сборка PDF каст листа из данных приложения.

Источник данных — тот же SSOT-срез, что отдаётся публичной ссылкой
(`ShortlistTokenService.get_view_data`), поэтому в PDF попадает ровно то, что
человек видит на экране: те же актёры, те же параметры, те же статусы.

Контакты актёров в отчёт намеренно не выгружаются: PDF легко уходит дальше по
переписке, а персональные данные должны оставаться в приложении.
"""
from __future__ import annotations

import asyncio
import logging
import re
import unicodedata
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib.parse import quote

import pytz

from .cast_list import (
    PHOTO_BOX_PX,
    CastListActor,
    CastListDocument,
    render_cast_list_pdf,
)
from .images import PhotoLoader, normalize_photo_url

logger = logging.getLogger(__name__)

MOSCOW_TZ = pytz.timezone("Europe/Moscow")

STATUS_LABELS: Dict[str, str] = {
    "new": "Новые",
    "accepted": "Принятые",
    "reserve": "Резерв",
}
ALL_STATUSES: Tuple[str, ...] = ("new", "accepted", "reserve")

#: Предохранитель от неадекватно больших выгрузок: каждая строка — это две
#: скачанные и пережатые фотографии, поэтому счёт нужно ограничить.
MAX_ACTORS_PER_EXPORT = 1000

#: Сколько отчётов воркер собирает одновременно. Генерация упирается в CPU и
#: сеть, поэтому без ограничения несколько параллельных выгрузок большого каст
#: листа способны «съесть» воркер и затормозить обычные запросы.
_BUILD_SEMAPHORE = asyncio.Semaphore(2)

#: Категории фото: чем меньше вес, тем выше приоритет при выборе портрета
#: и кадра в полный рост. Значения приходят и из media_assets (V2),
#: и из legacy `profile_images.image_type`.
_PORTRAIT_CATEGORIES: Tuple[str, ...] = ("portrait", "profile", "side_profile")
_FULL_HEIGHT_CATEGORIES: Tuple[str, ...] = ("full_height", "full_body")


@dataclass(slots=True)
class CastListPdf:
    """Готовый файл: байты и имя для `Content-Disposition`."""

    content: bytes
    filename: str
    actors_count: int

    @property
    def content_disposition(self) -> str:
        """Заголовок с ASCII-фолбэком и UTF-8 именем (RFC 5987).

        Без `filename*` браузер сохранит русское название как «????????.pdf».
        """
        ascii_name = _ascii_filename(self.filename)
        return (
            f'attachment; filename="{ascii_name}"; '
            f"filename*=UTF-8''{quote(self.filename, safe='')}"
        )


def _ascii_filename(name: str) -> str:
    """Транслитерация до ASCII для старых клиентов."""
    table = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e",
        "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
        "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
        "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "shch",
        "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
    }
    transliterated: List[str] = []
    for char in name:
        replacement = table.get(char.lower())
        if replacement is None:
            transliterated.append(char)
        else:
            # `capitalize`, а не `upper`: «Ж» → «Zh», иначе получалось бы «ZH».
            transliterated.append(replacement.capitalize() if char.isupper() else replacement)

    joined = "".join(transliterated)
    ascii_only = unicodedata.normalize("NFKD", joined).encode("ascii", "ignore").decode("ascii")
    ascii_only = re.sub(r"[^A-Za-z0-9._-]+", "_", ascii_only).strip("_")
    return ascii_only or "cast-list.pdf"


def _sanitize_filename(value: str) -> str:
    """Убрать из имени файла всё, что ломает заголовок или файловую систему."""
    cleaned = re.sub(r"[\\/:*?\"<>|\r\n\t]+", " ", value or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned[:80] or "Каст лист"


def parse_statuses(raw: Optional[str]) -> Optional[List[str]]:
    """Разобрать параметр статуса: `all`, `new` или `new,accepted`.

    `None` (и `all`) означает «все актёры каст листа». Неизвестное значение —
    ошибка запроса, а не молчаливая выгрузка всего списка.
    """
    if not raw:
        return None
    values = [value.strip().lower() for value in str(raw).split(",") if value.strip()]
    if not values or "all" in values:
        return None
    unknown = [value for value in values if value not in ALL_STATUSES]
    if unknown:
        raise ValueError(
            "Недопустимый статус: " + ", ".join(unknown)
            + ". Ожидается all, " + ", ".join(ALL_STATUSES)
        )
    return list(dict.fromkeys(values))


def actor_key(profile_id: Any, actor_profile_id: Any) -> str:
    """Ключ актёра в каст листе — как `actorCardKey` на фронтенде.

    Один legacy-профиль может быть представлен несколькими анкетами агента,
    поэтому идентификатор составной.
    """
    return f"{profile_id}:{actor_profile_id}" if actor_profile_id else f"{profile_id}:legacy"


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value)[:10]).date()
    except (TypeError, ValueError):
        return None


def calculate_age(date_of_birth: Any, today: Optional[date] = None) -> Optional[int]:
    born = _parse_date(date_of_birth)
    if born is None:
        return None
    today = today or datetime.now(MOSCOW_TZ).date()
    age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
    return age if 0 < age < 130 else None


def _full_name(profile: Dict[str, Any]) -> str:
    parts = [
        str(profile.get(field) or "").strip()
        for field in ("last_name", "first_name")
    ]
    name = " ".join(part for part in parts if part)
    return name or "Без имени"


def _category(image: Dict[str, Any]) -> str:
    raw = image.get("photo_category") or image.get("image_type") or ""
    return str(raw).lower()


def select_photo_urls(images: Sequence[Dict[str, Any]]) -> Tuple[Optional[str], Optional[str]]:
    """Выбрать портрет и кадр в полный рост — как в эталонном отчёте.

    Порядок `images` уже осмысленный (главное фото первым), поэтому при
    отсутствии категорий просто берём первые два кадра.
    """
    usable = [
        image for image in images or []
        if isinstance(image, dict) and (image.get("photo_url") or image.get("crop_photo_url"))
        and _category(image) != "video"
    ]
    if not usable:
        return None, None

    def take(categories: Tuple[str, ...]) -> Optional[Dict[str, Any]]:
        for image in usable:
            if _category(image) in categories:
                return image
        return None

    portrait = take(_PORTRAIT_CATEGORIES)
    full_height = take(_FULL_HEIGHT_CATEGORIES)

    if portrait is not None and full_height is portrait:
        full_height = None

    remaining = [image for image in usable if image is not portrait and image is not full_height]
    if portrait is None:
        portrait = remaining.pop(0) if remaining else None
    if full_height is None:
        full_height = remaining.pop(0) if remaining else None

    def url(image: Optional[Dict[str, Any]]) -> Optional[str]:
        if not image:
            return None
        return image.get("photo_url") or image.get("crop_photo_url")

    return url(portrait), url(full_height)


class CastListPdfService:
    """Собирает PDF каст листа по данным SSOT-среза."""

    @classmethod
    async def build_for_token(
        cls,
        token: str,
        statuses: Optional[Iterable[str]] = None,
        keys: Optional[Sequence[str]] = None,
        base_url: Optional[str] = None,
    ) -> Optional[CastListPdf]:
        """Собрать PDF по публичному токену/`public_id`. `None` — токен невалиден."""
        from shortlists.service import ShortlistTokenService

        report_id = await ShortlistTokenService.resolve_report_id(token=token)
        if report_id is None:
            return None
        return await cls.build_for_report(
            report_id=report_id,
            statuses=statuses,
            keys=keys,
            base_url=base_url,
        )

    @classmethod
    async def build_for_report(
        cls,
        report_id: int,
        statuses: Optional[Iterable[str]] = None,
        keys: Optional[Sequence[str]] = None,
        base_url: Optional[str] = None,
    ) -> Optional[CastListPdf]:
        """Собрать PDF по внутреннему id каст листа. `None` — каст листа нет."""
        from shortlists.service import ShortlistTokenService

        view_data = await ShortlistTokenService.get_view_data(report_id=report_id)
        if not view_data:
            return None

        return await cls.build_from_view_data(
            view_data=view_data,
            statuses=statuses,
            keys=keys,
            base_url=base_url,
        )

    @classmethod
    async def build_from_view_data(
        cls,
        view_data: Dict[str, Any],
        statuses: Optional[Iterable[str]] = None,
        keys: Optional[Sequence[str]] = None,
        base_url: Optional[str] = None,
    ) -> CastListPdf:
        async with _BUILD_SEMAPHORE:
            return await cls._build_from_view_data(
                view_data=view_data,
                statuses=statuses,
                keys=keys,
                base_url=base_url,
            )

    @classmethod
    async def _build_from_view_data(
        cls,
        view_data: Dict[str, Any],
        statuses: Optional[Iterable[str]] = None,
        keys: Optional[Sequence[str]] = None,
        base_url: Optional[str] = None,
    ) -> CastListPdf:
        title = str(view_data.get("title") or "Каст лист").strip() or "Каст лист"
        profiles = cls._select_profiles(
            profiles=view_data.get("profiles") or [],
            statuses=statuses,
            keys=keys,
        )

        photo_urls: List[Tuple[Optional[str], Optional[str]]] = []
        for profile in profiles:
            portrait, full_height = select_photo_urls(profile.get("images") or [])
            photo_urls.append(
                (
                    normalize_photo_url(portrait, base_url),
                    normalize_photo_url(full_height, base_url),
                )
            )

        loader = PhotoLoader(PHOTO_BOX_PX)
        photos = await loader.load(url for pair in photo_urls for url in pair)

        today = datetime.now(MOSCOW_TZ).date()
        actors = [
            CastListActor(
                number=index,
                full_name=_full_name(profile),
                age=calculate_age(profile.get("date_of_birth"), today),
                height=profile.get("height"),
                bust_volume=profile.get("bust_volume"),
                waist_volume=profile.get("waist_volume"),
                hip_volume=profile.get("hip_volume"),
                shoe_size=profile.get("shoe_size"),
                clothing_size=profile.get("clothing_size"),
                photos=(
                    photos.get(portrait_url) if portrait_url else None,
                    photos.get(full_height_url) if full_height_url else None,
                ),
            )
            for index, (profile, (portrait_url, full_height_url)) in enumerate(
                zip(profiles, photo_urls), start=1
            )
        ]

        document = CastListDocument(
            title=title,
            subtitle=cls._subtitle(statuses=statuses, actors_count=len(actors)),
            actors=actors,
        )

        # Вёрстка и пережатие картинок — синхронная CPU-работа: уводим в поток,
        # чтобы не блокировать event loop воркера на всё время генерации.
        content = await asyncio.to_thread(render_cast_list_pdf, document)

        logger.info(
            "PDF каст листа собран: %s актёров, %s КБ", len(actors), len(content) // 1024
        )

        return CastListPdf(
            content=content,
            filename=cls._filename(title, today),
            actors_count=len(actors),
        )

    @staticmethod
    def _select_profiles(
        profiles: Sequence[Dict[str, Any]],
        statuses: Optional[Iterable[str]],
        keys: Optional[Sequence[str]],
    ) -> List[Dict[str, Any]]:
        """Отобрать и упорядочить актёров для выгрузки.

        Если фронтенд передал `keys`, порядок и состав берём из них — так в PDF
        попадает именно то, что видно на экране, с учётом фильтров и сортировки.
        Иначе фильтруем по статусам.
        """
        if keys:
            by_key: Dict[str, Dict[str, Any]] = {
                actor_key(profile.get("id"), profile.get("actor_profile_id")): profile
                for profile in profiles
            }
            selected = [by_key[key] for key in dict.fromkeys(keys) if key in by_key]
        else:
            allowed = {status for status in (statuses or ALL_STATUSES) if status in ALL_STATUSES}
            if not allowed or allowed == set(ALL_STATUSES):
                selected = list(profiles)
            else:
                selected = [
                    profile for profile in profiles
                    if (profile.get("review_status") or "new") in allowed
                ]

        if len(selected) > MAX_ACTORS_PER_EXPORT:
            logger.warning(
                "PDF каст листа: выгрузка урезана до %s актёров из %s",
                MAX_ACTORS_PER_EXPORT, len(selected),
            )
            selected = selected[:MAX_ACTORS_PER_EXPORT]
        return selected

    @staticmethod
    def _subtitle(statuses: Optional[Iterable[str]], actors_count: int) -> str:
        selected = [status for status in (statuses or ()) if status in ALL_STATUSES]
        if selected and set(selected) != set(ALL_STATUSES):
            status_label = " · ".join(STATUS_LABELS[status] for status in selected)
        else:
            status_label = "Все актёры"

        generated_at = datetime.now(MOSCOW_TZ).strftime("%d.%m.%Y %H:%M")
        return f"{status_label} · {actors_count} {_plural_actors(actors_count)} · {generated_at}"

    @staticmethod
    def _filename(title: str, today: date) -> str:
        return f"{_sanitize_filename(title)} — каст лист {today.strftime('%d.%m.%Y')}.pdf"


def _plural_actors(count: int) -> str:
    """«1 актёр», «2 актёра», «5 актёров»."""
    tail_two = count % 100
    tail = count % 10
    if 11 <= tail_two <= 14:
        return "актёров"
    if tail == 1:
        return "актёр"
    if 2 <= tail <= 4:
        return "актёра"
    return "актёров"
