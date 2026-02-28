from typing import Optional

class BaseImageConfig:

    ALLOWED_EXTENSIONS: Optional[list] = None
    SUPPORTED_EXTENSIONS: Optional[list] = None
    MAX_IMAGE_SIZE: Optional[int] = None

