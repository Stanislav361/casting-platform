from typing import Any
from shared.services.google.sheets.commands.data.types import SheetData
from shared.services.google.protocols import GoogleCommandsProtocol

class UpdateSheetCommand(GoogleCommandsProtocol):

    def __init__(
            self,
            client: Any,
            sheet_id: str,
            data_chunk: SheetData
    ):
        self.client = client
        self.sheet_id = sheet_id
        self.data = data_chunk
        self.request_body = []

    def update_cells(self,):
        rows = []

        header_row = [
            {
                "userEnteredValue": {col.type: col.value},
                "userEnteredFormat": col.styles,
            }
            for col in self.data.columns.data
        ]
        rows.append({"values": header_row})

        for row in self.data.rows:
            values_cells = [{
                "userEnteredValue": {value.type: value.value},
                "userEnteredFormat": value.styles,
            } for value in row.data]
            rows.append({"values": values_cells})

        self.request_body.append({
            "updateCells": {
                "rows": rows,
                "fields": "userEnteredValue,userEnteredFormat",
                "start": {"sheetId": 0, "rowIndex": 0, "columnIndex": 0}
            }
        })
        # print(self.request_body[0]['updateCells']['rows'][0]['values'][0])

    def merge_cells(self, range_col_row: tuple):
        self.request_body.append({
            "mergeCells": {
                "range": {
                    "sheetId": 0,
                    "startRowIndex": range_col_row[0][0],
                    "endRowIndex": range_col_row[0][1],
                    "startColumnIndex": range_col_row[1][0],
                    "endColumnIndex": range_col_row[1][1]
                },
                "mergeType": "MERGE_ALL"
            }
        })

    def update_cells_size(self, header_row_size: int, col_size: int, row_size: int):
        self.request_body.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": 0,
                    "dimension": "COLUMNS",
                    "startIndex": 0,
                    "endIndex": len(self.data.columns.data) + 1
                },
                "properties": {
                    "pixelSize": col_size
                },
                "fields": "pixelSize"
            }
        })

        self.request_body.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": 0,
                    "dimension": "ROWS",
                    "startIndex": 0,
                    "endIndex": 1
                },
                "properties": {
                    "pixelSize": header_row_size
                },
                "fields": "pixelSize"
            }
        })

        self.request_body.append({
            "updateDimensionProperties": {
                "range": {
                    "sheetId": 0,
                    "dimension": "ROWS",
                    "startIndex": 1,
                    "endIndex": len(self.data.rows) + 1
                },
                "properties": {
                    "pixelSize": row_size
                },
                "fields": "pixelSize"
            }
        })

    def execute(self, header_row_size: int, col_size: int, row_size: int, merge_range_col_row: tuple):
        self.update_cells()
        self.update_cells_size(header_row_size, col_size, row_size)
        self.merge_cells(merge_range_col_row)

        self.client.spreadsheets().batchUpdate(
            spreadsheetId=self.sheet_id,
            body={'requests': self.request_body}
        ).execute()

        print("Данные записаны и стили применены")

