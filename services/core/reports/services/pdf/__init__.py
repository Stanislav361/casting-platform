"""Генерация PDF-отчётов (каст листов).

Здесь реэкспортируется только «чистый» слой вёрстки — он не зависит ни от БД,
ни от настроек приложения, поэтому его можно использовать и тестировать
изолированно. Слой, который собирает данные каст листа, живёт в
`reports.services.pdf.service` и импортируется напрямую.
"""
from .cast_list import (
    PHOTO_BOX_PX,
    CastListActor,
    CastListDocument,
    render_cast_list_pdf,
)
from .fonts import ensure_fonts_registered
from .images import PhotoLoader, normalize_photo_url

__all__ = [
    "PHOTO_BOX_PX",
    "CastListActor",
    "CastListDocument",
    "PhotoLoader",
    "ensure_fonts_registered",
    "normalize_photo_url",
    "render_cast_list_pdf",
]
