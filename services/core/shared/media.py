"""Единый вид медиа-ассета анкеты в ответах API.

Этот словарь собирался в шести местах `employer/routes.py` заново, и наборы
полей разошлись: где-то не было `thumbnail_url` (панель тянула полноразмерные
фото вместо превью), и **нигде** не было `photo_category`. Из-за последнего
супер-админ не мог управлять фото: чтобы предложить «заменить портрет», нужно
знать, какое из фото портрет, а какое — полный рост, а в ответе этого не было.

Поэтому вид один и здесь. Добавили поле — оно появилось во всех ответах сразу.
"""

from typing import Any


def media_asset_payload(asset: Any) -> dict:
    """Медиа-ассет для ответа API.

    `photo_category` — ракурс обязательного кадра (`portrait`, `profile`,
    `full_height`) либо `additional`; у видео он пустой.
    """
    return {
        "id": asset.id,
        "file_type": asset.file_type,
        "original_url": asset.original_url,
        "processed_url": asset.processed_url,
        "thumbnail_url": asset.thumbnail_url,
        "photo_category": asset.photo_category,
        "is_primary": asset.is_primary,
        "sort_order": asset.sort_order,
    }
