from shared.validation.image.configs.base import BaseImageConfig

class ImageConfig(BaseImageConfig):
    ALLOWED_EXTENSIONS: list = ["jpg", "jpeg", "png", "webp", 'heic', 'heif']
    MAX_IMAGE_SIZE: int = 10 * 1024 * 1024
    SUPPORTED_EXTENSIONS = {"jpg", "jpeg",}

image_config = ImageConfig()
