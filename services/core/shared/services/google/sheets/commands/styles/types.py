from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List, Literal

class Color(BaseModel):
    red: float = Field(..., alias="red")
    green: float = Field(..., alias="green")
    blue: float = Field(..., alias="blue")

class TextFormat(BaseModel):
    bold: Optional[bool] = Field(False, alias="bold")
    italic: Optional[bool] = Field(False, alias="italic")
    underline: Optional[bool] = Field(False, alias="underline")
    strikethrough: Optional[bool] = Field(False, alias="strikethrough")
    font_size: Optional[int] = Field(None, alias="fontSize")
    foreground_color: Optional[Color] = Field(None, alias="foregroundColor")
    font_family: Optional[str] = Field(None, alias="fontFamily")

class Border(BaseModel):
    style: Optional[Literal["DOTTED", "DASHED", "SOLID", "SOLID_MEDIUM", "SOLID_THICK", "NONE"]] = Field(None, alias="style")
    color: Optional[Color] = Field(default=None, alias="color")

class Borders(BaseModel):
    top: Optional[Border] = Field(None, alias="top")
    bottom: Optional[Border] = Field(None, alias="bottom")
    left: Optional[Border] = Field(None, alias="left")
    right: Optional[Border] = Field(None, alias="right")

class NumberFormat(BaseModel):
    type: Optional[Literal["TEXT", "NUMBER", "PERCENT", "CURRENCY", "DATE", "TIME", "DATE_TIME"]] = Field(None, alias="type")
    pattern: Optional[str] = Field(None, alias="pattern")

class UserEnteredFormat(BaseModel):
    background_color: Optional[Color] = Field(default=None, alias="backgroundColor")
    horizontal_alignment: Optional[Literal["LEFT", "CENTER", "RIGHT"]] = Field(default=None, alias="horizontalAlignment")
    vertical_alignment: Optional[Literal["TOP", "MIDDLE", "BOTTOM"]] = Field(default=None, alias="verticalAlignment")
    text_format: Optional[TextFormat] = Field(default=None, alias="textFormat")
    number_format: Optional[NumberFormat] = Field(default=None, alias="numberFormat")
    borders: Optional[Borders] = Field(default=None, alias="borders")
    wrap_strategy: Optional[Literal["OVERFLOW_CELL", "LEGACY_WRAP", "CLIP", "WRAP"]] = Field(default=None, alias="wrapStrategy")