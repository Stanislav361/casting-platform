import enum

class SearchFields(enum.Enum):
    FIRST_NAME = 'first_name'
    LAST_NAME = 'last_name'
    PHONE_NUMBER = 'phone_number'
    EMAIL = 'email'

class Gender(enum.Enum):
    male = "male"
    female = "female"

class Qualification(enum.Enum):
    professional = "professional"
    skilled = "skilled"
    enthusiast = "enthusiast"
    beginner = "beginner"
    other = "other"

class LookType(enum.Enum):
    asian = "asian"
    middle_eastern = "middle_eastern"
    african = "african"
    jewish = "jewish"
    european = "european"
    south_asian = "south_asian"
    caucasian = "caucasian"
    latino = "latino"
    mixed = "mixed"
    biracial = "biracial"
    slavic = "slavic"
    other = "other"

class HairColor(enum.Enum):
    blonde = "blonde"
    brunette = "brunette"
    brown = "brown"
    light_brown = "light_brown"
    red = "red" 
    gray = "gray"
    other = "other"

class HairLength(enum.Enum):
    short = "short"
    medium = "medium"
    long = "long"
    bald = "bald"


class ImageType(enum.Enum):
    portrait = "portrait"
    side_profile = "side_profile"
    full_body = "full_body"
    other = "other"