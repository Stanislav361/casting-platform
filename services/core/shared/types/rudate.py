from datetime import datetime, date
from pydantic import errors

class FlexibleDate(date):
    """Accepts 'YYYY-MM-DD' or 'DD.MM.YYYY', returns date object."""

    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, value):
        # Уже date? – отлично
        if isinstance(value, date):
            return value

        # Пробуем все нужные форматы
        if isinstance(value, str):
            for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
                try:
                    return datetime.strptime(value, fmt).date()
                except ValueError:
                    continue

        # Если не получилось – кидаем стандартную DateError
        raise errors.DateError()