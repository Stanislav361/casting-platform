import enum

class CastingStatusEnum(str, enum.Enum):
    unpublished = "unpublished"
    published = "published"
    closed = "closed"
    not_closed = 'not_closed'

class SearchFields(enum.Enum):
    TITLE = "title"