"""Загрузка и подготовка фотографий актёров для PDF-отчёта.

Каст лист на 200 актёров — это ~400 фотографий, поэтому здесь:

* загрузка идёт параллельно с ограничением одновременных соединений;
* байты кешируются в процессе (в отчёт часто попадают одни и те же актёры,
  а повторное скачивание — самая дорогая часть генерации);
* картинки сразу приводятся к целевому размеру ячейки и пережимаются в JPEG,
  иначе итоговый PDF весит десятки мегабайт;
* любая ошибка по отдельному фото не ломает отчёт — вместо картинки в
  таблице останется прочерк.
"""
from __future__ import annotations

import asyncio
import logging
import os
import ssl
from io import BytesIO
from typing import Dict, Iterable, List, NamedTuple, Optional, Sequence, Tuple

import httpx
from PIL import Image as PILImage
from PIL import ImageOps, UnidentifiedImageError

logger = logging.getLogger(__name__)

#: Одновременных загрузок. Больше 8 не даёт выигрыша — упираемся в S3/сеть,
#: зато растёт риск словить троттлинг на публичном бакете.
MAX_CONCURRENT_DOWNLOADS = 8

DOWNLOAD_TIMEOUT_SECONDS = 20.0

#: Фото больше 25 МБ в каст листе — почти наверняка ошибка загрузки, а не фото.
MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024

JPEG_QUALITY = 82

#: Сколько подготовленных картинок держим в памяти процесса.
_CACHE_MAX_ENTRIES = 512

_cache: Dict[Tuple[str, int, int], Optional[bytes]] = {}
_cache_lock = asyncio.Lock()

try:  # HEIC/HEIF с iPhone — без этого Pillow их не откроет.
    import pillow_heif

    pillow_heif.register_heif_opener()
except Exception:  # pragma: no cover - опциональная зависимость
    logger.debug("PDF: pillow-heif недоступен, HEIC-фото будут пропущены")


def _read_file(path: str) -> bytes:
    with open(path, "rb") as handle:
        return handle.read()


def _local_path_for_uploads(url: str) -> Optional[str]:
    """Отдать путь на диске для ссылки вида `.../uploads/<rel>`.

    Локально и в dev-режиме фото лежат на диске рядом с приложением — читать
    их напрямую быстрее и надёжнее, чем ходить к себе же по HTTP.
    """
    marker = "/uploads/"
    if marker not in url:
        return None
    relative = url.split(marker, 1)[1].split("?", 1)[0]
    uploads_root = os.environ.get("UPLOADS_DIR") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
        "uploads",
    )
    local_path = os.path.normpath(os.path.join(uploads_root, relative))
    # Защита от `../` в сохранённой ссылке.
    if not local_path.startswith(os.path.normpath(uploads_root) + os.sep):
        return None
    return local_path if os.path.isfile(local_path) else None


def normalize_photo_url(url: Optional[str], base_url: Optional[str] = None) -> Optional[str]:
    """Привести ссылку на фото к абсолютному виду.

    Часть ссылок в БД сохранена относительными (`/uploads/...`) — их нужно
    достроить адресом сервиса, иначе фото не скачается. Схему (http/https)
    намеренно НЕ переписываем: в отличие от браузера, серверу mixed content не
    мешает, а вот принудительный https ломает загрузку с хостов без TLS.
    Расхождение схемы разруливается ретраем в `_load_raw`.
    """
    if not url:
        return None
    url = url.strip()
    if not url:
        return None
    if url.startswith("//"):
        return f"https:{url}"
    if url.startswith(("http://", "https://")):
        return url
    if base_url:
        return f"{base_url.rstrip('/')}/{url.lstrip('/')}"
    return url


def _alternate_scheme_url(url: str) -> Optional[str]:
    """Тот же адрес с другой схемой.

    Исторически часть ссылок на `/uploads/...` сохранена с http, хотя сервис
    отдаёт их по https (и наоборот на локальной машине). Один ретрай с
    подменённой схемой закрывает оба случая.
    """
    if url.startswith("https://"):
        return "http://" + url[len("https://"):]
    if url.startswith("http://"):
        return "https://" + url[len("http://"):]
    return None


def _flatten_to_rgb(img: PILImage.Image) -> PILImage.Image:
    """Привести картинку к RGB, положив прозрачные области на белый фон.

    Прямой `convert("RGB")` заливает прозрачность чёрным — на белой странице
    отчёта фото с альфа-каналом (обычно PNG) получало бы чёрную рамку.
    """
    if img.mode == "RGB":
        return img
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        canvas = PILImage.new("RGB", rgba.size, (255, 255, 255))
        canvas.paste(rgba, mask=rgba.split()[-1])
        return canvas
    return img.convert("RGB")


def _fit_to_box(raw: bytes, box_px: Tuple[int, int]) -> Optional[bytes]:
    """Обрезать фото под пропорции ячейки и пережать в JPEG.

    Кадрируем «по заполнению» (как в вёрстке `object-fit: cover`) с небольшим
    смещением вверх: у портретов важнее сохранить лицо, чем нижний край.
    """
    try:
        with PILImage.open(BytesIO(raw)) as img:
            img = ImageOps.exif_transpose(img) or img
            img = _flatten_to_rgb(img)

            fitted = ImageOps.fit(
                img,
                box_px,
                method=PILImage.LANCZOS,
                centering=(0.5, 0.35),
            )

            out = BytesIO()
            fitted.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True, progressive=False)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, PILImage.DecompressionBombError) as exc:
        logger.warning("PDF: не удалось обработать фото: %s", exc)
        return None


class _Download(NamedTuple):
    """Результат попытки скачивания.

    `transport_failed` отделяет «не смогли достучаться» от «скачали, но
    забраковали»: во втором случае повторять запрос с другой схемой бессмысленно.
    """

    content: Optional[bytes]
    transport_failed: bool


async def _download(client: httpx.AsyncClient, url: str) -> _Download:
    """Скачать фото, обрывая закачку на превышении лимита размера.

    Читаем поток, а не `response.content`: иначе битая ссылка на многогигабайтный
    файл успела бы целиком оказаться в памяти воркера ещё до проверки размера.
    """
    chunks: List[bytes] = []
    try:
        async with client.stream("GET", url) as response:
            response.raise_for_status()

            declared = response.headers.get("content-length")
            if declared and declared.isdigit() and int(declared) > MAX_DOWNLOAD_BYTES:
                logger.warning("PDF: фото %s слишком большое (%s байт)", url[:120], declared)
                return _Download(None, transport_failed=False)

            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > MAX_DOWNLOAD_BYTES:
                    logger.warning(
                        "PDF: фото %s превысило лимит %s байт", url[:120], MAX_DOWNLOAD_BYTES
                    )
                    return _Download(None, transport_failed=False)
                chunks.append(chunk)
    except httpx.HTTPStatusError as exc:
        # Сервер ответил (404/403/500) — смена схемы ничего не изменит.
        logger.warning("PDF: фото %s недоступно: %s", url[:120], exc.response.status_code)
        return _Download(None, transport_failed=False)
    except (httpx.HTTPError, httpx.InvalidURL, ssl.SSLError) as exc:
        # `InvalidURL` не наследуется от `HTTPError`, поэтому указан отдельно.
        logger.warning("PDF: не удалось скачать фото %s: %s", url[:120], exc)
        return _Download(None, transport_failed=True)

    return _Download(b"".join(chunks) or None, transport_failed=False)


async def _load_raw(client: httpx.AsyncClient, url: str) -> Optional[bytes]:
    local_path = _local_path_for_uploads(url)
    if local_path:
        try:
            return await asyncio.to_thread(_read_file, local_path)
        except OSError as exc:
            logger.warning("PDF: не удалось прочитать %s: %s", local_path, exc)
            return None

    if not url.startswith(("http://", "https://")):
        logger.warning("PDF: пропускаю фото с неподдерживаемой ссылкой %r", url[:120])
        return None

    attempt = await _download(client, url)
    if attempt.content is not None or not attempt.transport_failed:
        return attempt.content

    fallback = _alternate_scheme_url(url)
    if fallback:
        return (await _download(client, fallback)).content
    return None


class PhotoLoader:
    """Готовит фотографии под конкретный размер ячейки таблицы."""

    def __init__(self, box_px: Tuple[int, int]) -> None:
        self._box_px = box_px

    async def load(self, urls: Iterable[Optional[str]]) -> Dict[str, bytes]:
        """Вернуть `{url: jpeg_bytes}` для тех ссылок, которые удалось получить."""
        unique: Sequence[str] = list(dict.fromkeys(url for url in urls if url))
        if not unique:
            return {}

        result: Dict[str, bytes] = {}
        missing: List[str] = []

        async with _cache_lock:
            for url in unique:
                key = (url, *self._box_px)
                if key in _cache:
                    cached = _cache[key]
                    if cached is not None:
                        result[url] = cached
                else:
                    missing.append(url)

        if not missing:
            return result

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_DOWNLOADS)
        limits = httpx.Limits(
            max_connections=MAX_CONCURRENT_DOWNLOADS,
            max_keepalive_connections=MAX_CONCURRENT_DOWNLOADS,
        )

        async with httpx.AsyncClient(
            timeout=DOWNLOAD_TIMEOUT_SECONDS,
            follow_redirects=True,
            limits=limits,
            headers={"User-Agent": "prostoprobuy-cast-list-pdf/1.0"},
        ) as client:

            async def worker(url: str) -> Tuple[str, Optional[bytes]]:
                async with semaphore:
                    raw = await _load_raw(client, url)
                if raw is None:
                    return url, None
                return url, await asyncio.to_thread(_fit_to_box, raw, self._box_px)

            prepared = await asyncio.gather(*(worker(url) for url in missing))

        async with _cache_lock:
            if len(_cache) > _CACHE_MAX_ENTRIES:
                _cache.clear()
            for url, payload in prepared:
                _cache[(url, *self._box_px)] = payload
                if payload is not None:
                    result[url] = payload

        return result
