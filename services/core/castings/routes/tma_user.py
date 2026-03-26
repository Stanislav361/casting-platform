from fastapi import APIRouter, Depends, Body, HTTPException
from users.dependencies.auth_depends import tma_authorized
from castings.schemas.tma_user import SProfileResponse
from users.services.auth_token.types.jwt import JWT
from castings.services.tma_user.service import TmaCastingService
from castings.schemas.tma_user import SCastingData

class TmaCastingRouter:
    def __init__(self):
        self.router = APIRouter(tags=["tma & casting"], prefix='/castings')
        self.include_routers()
        self.add_get_response()
        self.add_upload_image_route()
        self.add_delete_image_route()

    def include_routers(self ) -> None:
        self.add_get_casting_route()


    def add_get_casting_route(self, ):
        @self.router.get("/{casting_id}/")
        async def get_casting(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
        ) -> SCastingData:
            return await TmaCastingService.get_casting(user_token=authorized, casting_id=casting_id)

    def add_get_response(self, ):
        @self.router.get("/responses/{casting_id}/")
        async def get_response(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
        ) -> SProfileResponse:
            return await TmaCastingService.get_response(
                casting_id=casting_id,
                user_token=authorized
            )

    def add_upload_image_route(self):
        @self.router.post("/{casting_id}/upload-image/")
        async def upload_casting_image(
            casting_id: int,
            body: dict = Body(...),
            authorized: JWT = Depends(tma_authorized),
        ):
            import base64, uuid
            from io import BytesIO
            from PIL import Image as PILImage
            from sqlalchemy import select
            from postgres.database import async_session_maker as async_session
            from castings.models import Casting, CastingImage
            from shared.services.s3.services.media import S3MediaService

            image_base64 = body.get("image_base64", "")
            if not image_base64:
                raise HTTPException(status_code=400, detail="Пустое изображение")

            payload = image_base64.strip()
            if "," in payload:
                payload = payload.split(",", 1)[1]
            try:
                content = base64.b64decode(payload)
            except Exception:
                raise HTTPException(status_code=400, detail="Некорректный base64")

            if len(content) < 100:
                raise HTTPException(status_code=400, detail="Файл слишком маленький")
            if len(content) > 15 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Файл слишком большой (макс 15 МБ)")

            try:
                with PILImage.open(BytesIO(content)) as img:
                    img.verify()
                with PILImage.open(BytesIO(content)) as img:
                    if img.mode in ("RGBA", "LA", "P"):
                        img = img.convert("RGB")
                    max_side = 1920
                    w, h = img.size
                    if w > max_side or h > max_side:
                        ratio = min(max_side / w, max_side / h)
                        img = img.resize((int(w * ratio), int(h * ratio)), PILImage.LANCZOS)
                    buf = BytesIO()
                    img.save(buf, format="JPEG", quality=88, optimize=True)
                    content = buf.getvalue()
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Ошибка обработки: {type(e).__name__}")

            s3 = S3MediaService(directory="castings")
            image_id = base64.urlsafe_b64encode(uuid.uuid4().bytes).rstrip(b"=").decode("ascii")
            file_name = f"{image_id}.jpg"
            photo_url = f"{s3.base_url}/{file_name}"

            try:
                await s3.upload_file(file_name=file_name, file=content)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Ошибка S3: {type(e).__name__}")

            async with async_session() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Кастинг не найден")

                old_images = await session.execute(
                    select(CastingImage).where(CastingImage.parent_id == casting_id)
                )
                for old_img in old_images.scalars().all():
                    old_name = old_img.photo_url.split('/')[-1] if old_img.photo_url else None
                    if old_name:
                        try:
                            await s3.delete_file(old_name)
                        except Exception:
                            pass
                    await session.delete(old_img)

                new_img = CastingImage(parent_id=casting_id, photo_url=photo_url)
                session.add(new_img)
                casting.image_counter = 1
                await session.commit()

            return {"ok": True, "image_url": photo_url}

    def add_delete_image_route(self):
        @self.router.delete("/{casting_id}/delete-image/")
        async def delete_casting_image(
            casting_id: int,
            authorized: JWT = Depends(tma_authorized),
        ):
            from sqlalchemy import select
            from postgres.database import async_session_maker as async_session
            from castings.models import Casting, CastingImage
            from shared.services.s3.services.media import S3MediaService

            s3 = S3MediaService(directory="castings")
            async with async_session() as session:
                casting = await session.get(Casting, casting_id)
                if not casting:
                    raise HTTPException(status_code=404, detail="Кастинг не найден")

                result = await session.execute(
                    select(CastingImage).where(CastingImage.parent_id == casting_id)
                )
                for img in result.scalars().all():
                    old_name = img.photo_url.split('/')[-1] if img.photo_url else None
                    if old_name:
                        try:
                            await s3.delete_file(old_name)
                        except Exception:
                            pass
                    await session.delete(img)

                casting.image_counter = 0
                await session.commit()
            return {"ok": True}
