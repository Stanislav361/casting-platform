from pydantic import BaseModel, Field, model_validator, computed_field, ConfigDict
from profiles.schemas.admin import SActorImage
from dateutil.relativedelta import relativedelta
from profiles.enums import ImageType
from shared.services.google.sheets.commands.data.types import *
from shared.services.google.sheets.commands.styles.types import *

class SActorImageGenerateReport(SActorImage):
    crop_photo_url: Optional[str] = None

class ReportGeneratePartial(BaseModel):
    first_name: Optional[str] = Field(None, )
    last_name: Optional[str] = Field(None, )
    age: Optional[int] = Field(None, )

    height: Optional[float] = Field(None, )
    clothing_size: Optional[float] = Field(None, )
    shoe_size: Optional[float] = Field(None, )

    images: Optional[List[SActorImageGenerateReport]] = Field(None, exclude=True)
    date_of_birth: Optional[date] = Field(None, exclude=True)


    @model_validator(mode="after")  # noqa
    @classmethod
    def compute_age(cls, values):
        if values.date_of_birth:
            values.age = relativedelta(date.today(), values.date_of_birth).years
        return values

    @computed_field
    @property
    def images_list(self) -> Union[List[str], Dict, List[None]]:
        if self.images:
            image_priority = {
                ImageType.portrait: 1,
                ImageType.side_profile: 2,
                ImageType.full_body: 3,
                ImageType.other: 4,
            }
            target_images_type = [ImageType.portrait, ImageType.side_profile, ImageType.full_body]
            target_images = sorted(
                [image for image in self.images if image.image_type in target_images_type],
                key=lambda img: image_priority.get(img.image_type, 999) if img else 999
            )
            not_target_images = [image.crop_photo_url for image in self.images if image.image_type not in target_images_type]

            if target_images:
                target_images = [image.crop_photo_url for image in target_images]
                if len(target_images) < 3:
                    mixed_images = [*target_images, *not_target_images]
                    if len(mixed_images) < 3:
                        result_images = [*mixed_images, None, None, None][:3]
                        return result_images
                    result_images = mixed_images[:3]
                    return result_images
                return target_images
            else:
                images = [image.crop_photo_url for image in self.images]
                if len(images) < 3:
                    images = [*images, None, None, None]
                    result_images = images[:3]
                    return result_images
                return images
        return [None, None, None]

    #
    # @computed_field
    # @property
    # def video_intro(self) -> Optional[str]:
    #     if self.responses and len(self.responses) == 1:
    #         return self.responses[0].video_intro
    #     return None


    class Config:
        from_attributes = True
        arbitrary_types_allowed=True

class SReportColumnGenerate(BaseModel):
    first_name: Optional[str] = Field(default='Имя', alias='Имя')
    last_name: Optional[str] = Field(default='Фамилия', alias='Фамилия')
    images_1: Optional[str] = Field(default='Фотографии', alias='Фотографии')
    images_2: Optional[str] = Field(default='Фотографии', alias='Фотографии')
    images_3: Optional[str] = Field(default='Фотографии', alias='Фотографии')
    age: Optional[str] = Field(default='Возраст', alias='Возраст')
    height: Optional[str] = Field(default='Рост', alias='Рост')
    clothing_size: Optional[str] = Field(default='Размер одежды', alias='Размер одежды')
    shoe_size: Optional[str] = Field(default='Размер обуви', alias='Размер обуви')


    class Config:
        arbitrary_types_allowed=True


class SReportGenerate(BaseModel):
    columns: Optional[SReportColumnGenerate] = Field(default=SReportColumnGenerate(), )
    rows: List[Optional[ReportGeneratePartial]]

    @staticmethod
    def get_columns_styles() -> UserEnteredFormat:
        border = Border(
            style="SOLID_MEDIUM"
        )
        style = UserEnteredFormat(
            horizontalAlignment='CENTER',
            verticalAlignment="MIDDLE",
            textFormat=TextFormat(fontSize=14, fontFamily="Roboto Serif", bold=True),
            borders=Borders(top=border, bottom=border, left=border, right=border),
        )
        return style

    @staticmethod
    def get_rows_styles() -> UserEnteredFormat:
        border = Border(
            style="SOLID"
        )
        style = UserEnteredFormat(
            horizontalAlignment='CENTER',
            verticalAlignment="MIDDLE",
            textFormat=TextFormat(fontSize=12, fontFamily="Roboto Serif"),
            borders=Borders(top=border, bottom=border, left=border, right=border),
        )
        print(style.model_dump(exclude_none=True, by_alias=True))
        return style

    def get_sheet_data(self) -> SheetData:
        columns_styles = self.get_columns_styles()
        rows_styles = self.get_rows_styles()

        rows_data: List[SheetRow] = []
        for row_ind, row in enumerate(self.rows, start=1):
            rows_data.append(SheetRow(data=[
                StringValue(value=row.last_name, styles=rows_styles, col_idx=0, row_idx=row_ind),
                StringValue(value=row.first_name, styles=rows_styles, col_idx=1, row_idx=row_ind),
                *[ImageValue(value=image, styles=rows_styles, col_idx=col_ind, row_idx=row_ind) for col_ind, image in enumerate(row.images_list, start=2)],
                IntegerValue(value=row.age, styles=rows_styles, col_idx=5, row_idx=row_ind),
                FloatValue(value=row.height, styles=rows_styles, col_idx=6, row_idx=row_ind),
                FloatValue(value=row.clothing_size, styles=rows_styles, col_idx=7, row_idx=row_ind),
                FloatValue(value=row.shoe_size, styles=rows_styles, col_idx=8, row_idx=row_ind),
            ]))
        columns_data = SheetColumns(
            data=[
                ColumnValue(
                    value=field.alias,
                    styles=columns_styles,
                    row_idx=0,
                    col_idx=col_ind
                ) for col_ind, field in enumerate(SReportColumnGenerate.model_fields.values())
            ]
        )
        sheet_data = SheetData(columns=columns_data, rows=rows_data)
        return sheet_data

    class Config:
        arbitrary_types_allowed = True