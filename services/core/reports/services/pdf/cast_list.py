"""Вёрстка PDF каст листа.

Формат повторяет привычную кастинг-директорам таблицу:

    ┌────┬──────────────┬─────────────────────────┬────────────┐
    │ №  │ ФИ/ВОЗРАСТ   │      ФОТО АКТЕРА        │ ПАРАМЕТРЫ  │
    ├────┼──────────────┼────────────┬────────────┼────────────┤
    │ 1  │ Римский      │            │            │ рост 185см │
    │    │ Станислав 37 │   портрет  │  в полный  │ 102-81-94  │
    │    │              │            │    рост    │ обувь 45   │
    └────┴──────────────┴────────────┴────────────┴────────────┘

Геометрия (ширины колонок, высота строк, размер кегля) снята с эталонного
отчёта, поэтому распечатка выглядит идентично — с той разницей, что здесь
используется A4 вместо Letter: в России печатают на A4, а на разбивку это не
влияет, на страницу по-прежнему помещается ровно три актёра.

Модуль намеренно не знает ни про БД, ни про настройки приложения: на вход
приходят готовые данные и уже подготовленные JPEG-байты фотографий.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from io import BytesIO
from typing import List, Optional, Sequence, Tuple
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen import canvas as pdf_canvas
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .fonts import ensure_fonts_registered

logger = logging.getLogger(__name__)

PAGE_SIZE = A4
PAGE_WIDTH, PAGE_HEIGHT = PAGE_SIZE

#: Ширины колонок и высоты строк — в пунктах, как в эталонном отчёте.
COL_NUMBER_WIDTH = 60.80
COL_NAME_WIDTH = 92.70
COL_PHOTO_WIDTH = 131.31
COL_PARAMS_WIDTH = 95.86

COL_WIDTHS: Tuple[float, ...] = (
    COL_NUMBER_WIDTH,
    COL_NAME_WIDTH,
    COL_PHOTO_WIDTH,
    COL_PHOTO_WIDTH,
    COL_PARAMS_WIDTH,
)
TABLE_WIDTH = sum(COL_WIDTHS)

HEADER_ROW_HEIGHT = 36.04
DATA_ROW_HEIGHT = 184.86

#: Фотографии кадрируются в 2:3 и почти полностью занимают ячейку.
PHOTO_HEIGHT = 184.30
PHOTO_WIDTH = PHOTO_HEIGHT * 2 / 3
PHOTO_PADDING_X = (COL_PHOTO_WIDTH - PHOTO_WIDTH) / 2
PHOTO_PADDING_Y = (DATA_ROW_HEIGHT - PHOTO_HEIGHT) / 2

#: Растр фотографии — примерно 2.5x от размера на странице (~175 dpi):
#: печать остаётся чёткой, а вес файла не улетает в десятки мегабайт.
PHOTO_RASTER_SCALE = 2.5
PHOTO_BOX_PX: Tuple[int, int] = (
    round(PHOTO_WIDTH * PHOTO_RASTER_SCALE),
    round(PHOTO_HEIGHT * PHOTO_RASTER_SCALE),
)

MARGIN_X = (PAGE_WIDTH - TABLE_WIDTH) / 2
MARGIN_TOP = 53.46
MARGIN_BOTTOM = 53.46

BODY_FONT_SIZE = 9.4
BODY_LEADING = 12.0

GRID_LINE_WIDTH = 0.75
OUTER_LINE_WIDTH = 1.1

HEADERS: Tuple[str, ...] = ("№", "ФИ/ВОЗРАСТ", "ФОТО АКТЕРА", "ПАРАМЕТРЫ")


@dataclass(slots=True)
class CastListActor:
    """Одна строка таблицы."""

    number: int
    full_name: str
    age: Optional[int] = None
    height: Optional[float] = None
    bust_volume: Optional[float] = None
    waist_volume: Optional[float] = None
    hip_volume: Optional[float] = None
    shoe_size: Optional[float] = None
    clothing_size: Optional[float] = None
    #: JPEG-байты портрета и фото в полный рост (любой может отсутствовать).
    photos: Tuple[Optional[bytes], Optional[bytes]] = (None, None)


@dataclass(slots=True)
class CastListDocument:
    """Данные для сборки документа."""

    title: str
    subtitle: Optional[str] = None
    actors: List[CastListActor] = field(default_factory=list)


def format_number(value: Optional[float]) -> Optional[str]:
    """`185.0` → «185», `42.5` → «42,5». Дробную часть пишем через запятую."""
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    if number.is_integer():
        return str(int(number))
    return f"{number:.1f}".replace(".", ",")


def format_name_cell(actor: CastListActor) -> str:
    """«Римский Станислав 37» — фамилия, имя и возраст одной строкой."""
    name = (actor.full_name or "").strip()
    parts = [part for part in (name, str(actor.age) if actor.age else None) if part]
    return " ".join(parts) or "—"


def format_params_cell(actor: CastListActor) -> str:
    """«рост 185см 102-81-94 обувь 45» — как в эталонном отчёте.

    Незаполненные параметры просто пропускаются: пустых «—» в ячейке быть не
    должно, иначе таблица становится нечитаемой.
    """
    chunks: List[str] = []

    height = format_number(actor.height)
    if height:
        chunks.append(f"рост {height}см")

    bust = format_number(actor.bust_volume)
    waist = format_number(actor.waist_volume)
    hip = format_number(actor.hip_volume)
    if bust and waist and hip:
        chunks.append(f"{bust}-{waist}-{hip}")

    shoe = format_number(actor.shoe_size)
    if shoe:
        chunks.append(f"обувь {shoe}")

    clothing = format_number(actor.clothing_size)
    if clothing:
        chunks.append(f"размер {clothing}")

    return " ".join(chunks) or "—"


class _NumberedCanvas(pdf_canvas.Canvas):
    """Canvas, который умеет печатать «стр. 1 из 4».

    Общее число страниц известно только после вёрстки всего документа, поэтому
    страницы складываются в память и дорисовываются на этапе `save()`.
    """

    def __init__(self, *args, **kwargs) -> None:
        self._footer_font: str = kwargs.pop("footer_font", "Helvetica")
        super().__init__(*args, **kwargs)
        self._saved_page_states: List[dict] = []

    # camelCase в именах ниже — это переопределение методов ReportLab.
    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(total_pages)
            super().showPage()
        super().save()

    def _draw_footer(self, total_pages: int) -> None:
        self.setFont(self._footer_font, 8)
        self.setFillColor(colors.HexColor("#6b7280"))
        self.drawCentredString(
            PAGE_WIDTH / 2,
            MARGIN_BOTTOM / 2,
            f"стр. {self._pageNumber} из {total_pages}",
        )


def _build_styles(regular_font: str, bold_font: str) -> dict:
    return {
        "header": ParagraphStyle(
            "cast-list-header",
            fontName=bold_font,
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            alignment=TA_CENTER,
            textColor=colors.black,
        ),
        "cell": ParagraphStyle(
            "cast-list-cell",
            fontName=regular_font,
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            alignment=TA_CENTER,
            textColor=colors.black,
        ),
        "muted": ParagraphStyle(
            "cast-list-muted",
            fontName=regular_font,
            fontSize=BODY_FONT_SIZE,
            leading=BODY_LEADING,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#9ca3af"),
        ),
        "title": ParagraphStyle(
            "cast-list-title",
            fontName=bold_font,
            fontSize=14,
            leading=17,
            alignment=TA_CENTER,
            textColor=colors.black,
        ),
        "subtitle": ParagraphStyle(
            "cast-list-subtitle",
            fontName=regular_font,
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#6b7280"),
            spaceAfter=6,
        ),
    }


def _photo_cell(data: Optional[bytes], styles: dict):
    if not data:
        return Paragraph("нет фото", styles["muted"])
    # lazy=0 обязателен: ReportLab иначе попытается перечитать «файл» на этапе
    # отрисовки, а у нас это поток в памяти.
    return Image(BytesIO(data), width=PHOTO_WIDTH, height=PHOTO_HEIGHT, lazy=0)


def _table_style() -> TableStyle:
    return TableStyle(
        [
            ("GRID", (0, 0), (-1, -1), GRID_LINE_WIDTH, colors.black),
            ("BOX", (0, 0), (-1, -1), OUTER_LINE_WIDTH, colors.black),
            ("LINEBELOW", (0, 0), (-1, 0), OUTER_LINE_WIDTH, colors.black),
            # «ФОТО АКТЕРА» — общий заголовок над двумя колонками с фото.
            ("SPAN", (2, 0), (3, 0)),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (2, 1), (3, -1), PHOTO_PADDING_X),
            ("RIGHTPADDING", (2, 1), (3, -1), PHOTO_PADDING_X),
            ("TOPPADDING", (2, 1), (3, -1), PHOTO_PADDING_Y),
            ("BOTTOMPADDING", (2, 1), (3, -1), PHOTO_PADDING_Y),
        ]
    )


def _build_table(actors: Sequence[CastListActor], styles: dict) -> Table:
    rows: List[list] = [
        [
            Paragraph(escape(HEADERS[0]), styles["header"]),
            Paragraph(escape(HEADERS[1]), styles["header"]),
            Paragraph(escape(HEADERS[2]), styles["header"]),
            "",  # объединено с предыдущей ячейкой через SPAN
            Paragraph(escape(HEADERS[3]), styles["header"]),
        ]
    ]

    for actor in actors:
        portrait, full_height = actor.photos
        rows.append(
            [
                Paragraph(str(actor.number), styles["cell"]),
                Paragraph(escape(format_name_cell(actor)), styles["cell"]),
                _photo_cell(portrait, styles),
                _photo_cell(full_height, styles),
                Paragraph(escape(format_params_cell(actor)), styles["cell"]),
            ]
        )

    table = Table(
        rows,
        colWidths=list(COL_WIDTHS),
        rowHeights=[HEADER_ROW_HEIGHT] + [DATA_ROW_HEIGHT] * len(actors),
        repeatRows=1,
        hAlign="CENTER",
    )
    table.setStyle(_table_style())
    return table


def render_cast_list_pdf(document: CastListDocument) -> bytes:
    """Собрать PDF и вернуть его байтами.

    Функция синхронная и заметно нагружает CPU — вызывать её из корутины
    следует через `asyncio.to_thread`, чтобы не блокировать event loop.
    """
    regular_font, bold_font = ensure_fonts_registered()
    styles = _build_styles(regular_font, bold_font)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN_X,
        rightMargin=MARGIN_X,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM,
        title=document.title,
        author="prostoprobuy.pro",
        subject="Каст лист",
        creator="prostoprobuy.pro",
    )

    story: List = [Paragraph(escape(document.title or "Каст лист"), styles["title"])]
    if document.subtitle:
        story.append(Paragraph(escape(document.subtitle), styles["subtitle"]))
    story.append(Spacer(1, 6))

    if document.actors:
        story.append(_build_table(document.actors, styles))
    else:
        story.append(Paragraph("В каст листе нет актёров.", styles["muted"]))

    def make_canvas(*args, **kwargs):
        return _NumberedCanvas(*args, footer_font=regular_font, **kwargs)

    doc.build(story, canvasmaker=make_canvas)
    return buffer.getvalue()
