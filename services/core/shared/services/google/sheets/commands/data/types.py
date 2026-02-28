from pydantic import HttpUrl, BaseModel
from abc import ABC, abstractmethod
from datetime import datetime, date
from typing import Any, List, Type, Union, Protocol, Optional
from shared.services.google.sheets.commands.styles.types import UserEnteredFormat

class TypeBase(ABC):
    @abstractmethod
    def __init__(self, styles: UserEnteredFormat, value: Any, col_idx: int, row_idx: int) -> None:
        self.styles = styles
        self.value = value
        self.col_idx = col_idx
        self.row_idx = row_idx
        self.type = None

    def __str__(self) -> Any:
        if self.value is None:
            return str()
        return str(self.value)

    def __repr__(self) -> Any:
        if self.value is None:
            return str()
        return str(self.value)



class StringValue(TypeBase):
    def __init__(self, styles: UserEnteredFormat, value: str, col_idx: int, row_idx: int) -> None:
        self.styles = styles.model_dump(exclude_none=True, by_alias=True)
        self.value = value if value is not None else "Пусто"
        self.col_idx = col_idx
        self.row_idx = row_idx
        self.type = 'stringValue'

class IntegerValue(TypeBase):
    def __init__(self, styles: UserEnteredFormat, value: int, col_idx: int, row_idx: int) -> None:
        self.styles = styles.model_dump(exclude_none=True, by_alias=True)
        self.value = value if value is not None else "Пусто"
        self.col_idx = col_idx
        self.row_idx = row_idx
        self.type = 'numberValue' if value is not None else 'stringValue'


class FloatValue(TypeBase):
    def __init__(self, styles: UserEnteredFormat, value: float, col_idx: int, row_idx: int) -> None:
        self.styles = styles.model_dump(exclude_none=True, by_alias=True)
        self.value = value if value is not None else "Пусто"
        self.col_idx = col_idx
        self.row_idx = row_idx
        self.type = 'numberValue' if value is not None else 'stringValue'


class DateValue(TypeBase):
    def __init__(self, styles: UserEnteredFormat, value: date, col_idx: int, row_idx: int) -> None:
        self.styles = styles.model_dump(exclude_none=True, by_alias=True)
        self.value = value if value is not None else 'Пусто'
        self.col_idx = col_idx
        self.row_idx = row_idx
        self.type = 'stringValue'



class DateTimeValue(TypeBase):
    def __init__(self, styles: UserEnteredFormat, value: datetime, col_idx: int, row_idx: int) -> None:
        self.styles = styles.model_dump(exclude_none=True, by_alias=True)
        self.value = value if value is not None else 'Пусто'
        self.col_idx = col_idx
        self.row_idx = row_idx
        self.type = 'stringValue'


class ImageValue(TypeBase):
    def __init__(self, styles: UserEnteredFormat, value: Optional[str], col_idx: int, row_idx: int) -> None:
        self.styles = styles.model_dump(exclude_none=True, by_alias=True)
        self.value = f'=IMAGE("{value}")' if value is not None else 'Пусто'
        self.col_idx = col_idx
        self.row_idx = row_idx
        self.type = 'formulaValue' if value is not None else 'stringValue'


class ColumnValue(TypeBase):
    def __init__(self, styles: UserEnteredFormat, value: Any, col_idx: int, row_idx: int) -> None:
        self.styles = styles.model_dump(exclude_none=True, by_alias=True)
        self.value = value if value is not None else 'Пусто'
        self.col_idx = col_idx
        self.row_idx = row_idx
        self.type = 'stringValue'


class SheetColumns(BaseModel):
    data: List[ColumnValue]

    class Config:
        arbitrary_types_allowed=True

class SheetRow(BaseModel):
    data: List[TypeBase]

    class Config:
        arbitrary_types_allowed=True

class SheetData(BaseModel):
    columns: SheetColumns
    rows: List[SheetRow]

    def get_sheet_data(self) -> List[List[str]]:
        return [
                self.columns.get_values(),
                *[[str(cell) for cell in row.data] for row in self.rows]
        ]

    class Config:
        arbitrary_types_allowed=True
