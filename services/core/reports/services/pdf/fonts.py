"""Регистрация шрифтов для PDF-отчётов.

Встроенные в ReportLab шрифты (Helvetica/Times) не содержат кириллицы, а в
образе `python:3.12-slim` системных шрифтов нет вообще. Поэтому PT Serif
(SIL OFL, разработан специально под кириллицу) лежит рядом с кодом в
`shared/assets/fonts` — это гарантирует одинаковый результат локально,
в Docker и на Railway.

Системные пути проверяются как запасной вариант: если вендорные файлы
потеряются при сборке образа, отчёт всё равно соберётся на любом
кириллическом шрифте, который найдётся в системе.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import List, Optional, Tuple

from reportlab.lib.fonts import addMapping
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFError, TTFont

logger = logging.getLogger(__name__)

#: Внутренние имена, под которыми шрифты регистрируются в ReportLab.
FONT_REGULAR = "CastListSerif"
FONT_BOLD = "CastListSerif-Bold"

#: services/core/shared/assets/fonts
_VENDORED_FONT_DIR = Path(__file__).resolve().parents[3] / "shared" / "assets" / "fonts"

#: Пары (regular, bold) в порядке приоритета. Первая найденная пара выигрывает.
_FONT_CANDIDATES: Tuple[Tuple[Path, Path], ...] = (
    (
        _VENDORED_FONT_DIR / "PTSerif-Regular.ttf",
        _VENDORED_FONT_DIR / "PTSerif-Bold.ttf",
    ),
    # Debian/Ubuntu: fonts-dejavu-core, fonts-liberation
    (
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"),
    ),
    (
        Path("/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"),
        Path("/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf"),
    ),
    (
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ),
    # macOS — только для локальной разработки.
    (
        Path("/System/Library/Fonts/Supplemental/Times New Roman.ttf"),
        Path("/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf"),
    ),
    (
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ),
)

_lock = threading.Lock()
_registered = False


def _find_font_pair() -> Optional[Tuple[Path, Path]]:
    for regular, bold in _FONT_CANDIDATES:
        if regular.is_file():
            # Bold необязателен: если его нет, используем regular и для
            # заголовков — это лучше, чем падать при генерации отчёта.
            return regular, bold if bold.is_file() else regular
    return None


def _searched_paths() -> List[str]:
    return [str(regular) for regular, _ in _FONT_CANDIDATES]


def ensure_fonts_registered() -> Tuple[str, str]:
    """Зарегистрировать шрифты в ReportLab и вернуть `(regular, bold)`.

    Идемпотентно и потокобезопасно: ReportLab держит шрифты в глобальном
    реестре, а Gunicorn-воркеры собирают отчёты в пуле потоков.
    """
    global _registered

    if _registered:
        return FONT_REGULAR, FONT_BOLD

    with _lock:
        if _registered:
            return FONT_REGULAR, FONT_BOLD

        pair = _find_font_pair()
        if pair is None:
            raise RuntimeError(
                "Не найден TTF-шрифт с поддержкой кириллицы для PDF-отчёта. "
                "Ожидался файл " + str(_VENDORED_FONT_DIR / "PTSerif-Regular.ttf")
                + ". Проверены пути: " + ", ".join(_searched_paths())
            )

        regular_path, bold_path = pair
        try:
            pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(regular_path)))
            pdfmetrics.registerFont(TTFont(FONT_BOLD, str(bold_path)))
        except (TTFError, OSError) as exc:
            raise RuntimeError(
                f"Не удалось загрузить шрифт для PDF-отчёта ({regular_path}): {exc}"
            ) from exc

        # Чтобы разметка <b> внутри Paragraph переключалась на bold-начертание.
        pdfmetrics.registerFontFamily(
            FONT_REGULAR,
            normal=FONT_REGULAR,
            bold=FONT_BOLD,
            italic=FONT_REGULAR,
            boldItalic=FONT_BOLD,
        )
        addMapping(FONT_REGULAR, 0, 0, FONT_REGULAR)
        addMapping(FONT_REGULAR, 1, 0, FONT_BOLD)
        addMapping(FONT_REGULAR, 0, 1, FONT_REGULAR)
        addMapping(FONT_REGULAR, 1, 1, FONT_BOLD)

        logger.info("PDF: шрифты зарегистрированы (%s, %s)", regular_path.name, bold_path.name)
        _registered = True

    return FONT_REGULAR, FONT_BOLD
