from shared.validation.image.configs.base import BaseImageConfig

class ImageConfig(BaseImageConfig):
    ALLOWED_EXTENSIONS: list = ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif", "avif", "mpo"]
    MAX_IMAGE_SIZE: int = 100 * 1024 * 1024

image_config = ImageConfig()
