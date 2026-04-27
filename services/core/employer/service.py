"""
Employer Service — бизнес-логика для работодателя (Admin) и актёра.
- Employer: CRUD своих проектов + просмотр откликнувшихся
- Actor: лента проектов + отклики + история
- SuperAdmin: полный доступ
"""
import base64
import os
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import joinedload

from postgres.database import async_session_maker as async_session
from castings.models import Casting, CastingImage, ProjectCollaborator
from profiles.models import Profile, Response
from users.models import User
from users.enums import Roles
from users.services.auth_token.types.jwt import JWT
from fastapi import HTTPException, UploadFile, status
from crm.models import NotificationType
from crm.service import NotificationService, ActionLogService
from castings.enums import CastingStatusEnum
from shared.services.s3.services.media import S3MediaService


class EmployerService:
    """Сервис для работодателя — управление своими проектами."""

    S3 = S3MediaService(directory="castings")

    @staticmethod
    def _display_user_name(user: User | None, fallback: str = "Участник команды") -> str:
        if not user:
            return fallback
        parts = [p for p in [user.first_name, user.last_name] if p]
        return " ".join(parts) if parts else (user.email or fallback)
    UPLOADS_DIR = os.environ.get("UPLOADS_DIR") or os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "uploads",
    )

    @staticmethod
    async def _save_casting_image_file(file_name: str, content: bytes, base_url: str = "") -> str:
        try:
            await EmployerService.S3.upload_file(file_name=file_name, file=content)
            return f"{EmployerService.S3.base_url}/{file_name}"
        except Exception:
            local_path = os.path.join(EmployerService.UPLOADS_DIR, "castings", file_name)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as file_obj:
                file_obj.write(content)

            if base_url:
                return f"{base_url.rstrip('/')}/uploads/castings/{file_name}"
            return f"/uploads/castings/{file_name}"

    @staticmethod
    async def _delete_casting_image_file(photo_url: Optional[str]) -> None:
        if not photo_url:
            return

        marker = "/uploads/castings/"
        if marker in photo_url:
            local_name = photo_url.split(marker, 1)[1]
            local_path = os.path.join(EmployerService.UPLOADS_DIR, "castings", local_name)
            try:
                os.remove(local_path)
            except FileNotFoundError:
                pass
            return

        old_name = photo_url.split("/")[-1]
        if old_name:
            try:
                await EmployerService.S3.delete_file(old_name)
            except Exception:
                pass

    @staticmethod
    async def _get_casting_image_url(session, casting_id: int, casting: Optional[Casting] = None) -> Optional[str]:
        if casting is not None:
            relation_images = getattr(casting, "image", None) or []
            if relation_images:
                sorted_images = sorted(
                    relation_images,
                    key=lambda img: (
                        getattr(img, "updated_at", None) or getattr(img, "created_at", None) or datetime.min.replace(tzinfo=timezone.utc),
                        getattr(img, "created_at", None) or datetime.min.replace(tzinfo=timezone.utc),
                    ),
                    reverse=True,
                )
                relation_photo = next((img.photo_url for img in sorted_images if getattr(img, "photo_url", None)), None)
                if relation_photo:
                    return relation_photo

        image_result = await session.execute(
            select(CastingImage)
            .where(CastingImage.parent_id == casting_id)
            .order_by(CastingImage.updated_at.desc(), CastingImage.created_at.desc())
            .limit(1)
        )
        image = image_result.scalar_one_or_none()
        return image.photo_url if image else None

    @staticmethod
    async def _store_casting_image_content(
        user_token: JWT,
        casting_id: int,
        content: bytes,
        base_url: str = "",
    ) -> dict:
        from io import BytesIO
        from PIL import Image as PILImage
        import uuid

        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Проект не найден")

            role = user_token.role
            has_access = role in [Roles.owner.value, 'owner'] or getattr(casting, 'owner_id', None) == int(user_token.id)
            if not has_access:
                collab = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == casting_id,
                        ProjectCollaborator.user_id == int(user_token.id),
                    )
                )
                has_access = collab.scalar_one_or_none() is not None
            if not has_access:
                raise HTTPException(status_code=403, detail="Нет доступа")

            if not content or len(content) < 100:
                raise HTTPException(status_code=400, detail="Пустой файл")
            if len(content) > 15 * 1024 * 1024:
                raise HTTPException(status_code=400, detail="Файл слишком большой (макс. 15 МБ)")

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
                raise HTTPException(status_code=400, detail=f"Не удалось обработать изображение: {type(e).__name__}")

            image_id = base64.urlsafe_b64encode(uuid.uuid4().bytes).rstrip(b"=").decode("ascii")
            file_name = f"{image_id}.jpg"
            photo_url = await EmployerService._save_casting_image_file(
                file_name=file_name,
                content=content,
                base_url=base_url,
            )

            existing_images = await session.execute(
                select(CastingImage).where(CastingImage.parent_id == casting_id)
            )
            for old_img in existing_images.scalars().all():
                await EmployerService._delete_casting_image_file(old_img.photo_url)
                await session.delete(old_img)

            new_img = CastingImage(parent_id=casting_id, photo_url=photo_url)
            session.add(new_img)
            casting.image_counter = 1
            await session.commit()

            return {
                "ok": True,
                "image_url": photo_url,
                "message": "Image uploaded successfully",
            }

    @staticmethod
    async def upload_casting_image(
        user_token: JWT,
        casting_id: int,
        image: UploadFile,
        base_url: str = "",
    ) -> dict:
        content = await image.read()
        return await EmployerService._store_casting_image_content(
            user_token=user_token,
            casting_id=casting_id,
            content=content,
            base_url=base_url,
        )

    @staticmethod
    async def upload_casting_image_base64(
        user_token: JWT,
        casting_id: int,
        image_base64: str,
        base_url: str = "",
    ) -> dict:
        if not image_base64:
            raise HTTPException(status_code=400, detail="Пустое изображение")
        payload = image_base64.strip()
        if "," in payload:
            payload = payload.split(",", 1)[1]
        try:
            content = base64.b64decode(payload)
        except Exception:
            raise HTTPException(status_code=400, detail="Некорректный base64")
        return await EmployerService._store_casting_image_content(
            user_token=user_token,
            casting_id=casting_id,
            content=content,
            base_url=base_url,
        )

    @staticmethod
    async def delete_casting_image(user_token: JWT, casting_id: int) -> dict:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            has_access = role in [Roles.owner.value, 'owner'] or getattr(casting, 'owner_id', None) == int(user_token.id)
            if not has_access:
                collab = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == casting_id,
                        ProjectCollaborator.user_id == int(user_token.id),
                    )
                )
                has_access = collab.scalar_one_or_none() is not None
            if not has_access:
                raise HTTPException(status_code=403, detail="Not your project")

            result = await session.execute(
                select(CastingImage).where(CastingImage.parent_id == casting_id)
            )
            for img in result.scalars().all():
                await EmployerService._delete_casting_image_file(img.photo_url)
                await session.delete(img)

            casting.image_counter = 0
            await session.commit()
            return {"ok": True, "message": "Image deleted"}

    @staticmethod
    async def create_project(user_token: JWT, title: str, description: str) -> dict:
        async with async_session() as session:
            casting = Casting(
                title=title,
                description=description,
                owner_id=int(user_token.id),
                status=CastingStatusEnum.published,
            )
            session.add(casting)
            await session.flush()
            await session.commit()
            try:
                await ActionLogService.log_event(
                    casting_id=casting.id,
                    user_id=int(user_token.id),
                    action_type='project_created',
                    message=f"Project created: {casting.title}",
                )
            except Exception:
                pass
            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": casting.owner_id,
                "response_count": 0,
                "image_url": await EmployerService._get_casting_image_url(session, casting.id),
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def get_my_projects(user_token: JWT, page: int = 1, page_size: int = 20, archived: bool = False) -> dict:
        async with async_session() as session:
            user_id = int(user_token.id)
            role = user_token.role

            from castings.models import ProjectCollaborator
            from reports.models import Report
            base_query = select(Casting).where(
                Casting.parent_project_id == None,
                Casting.is_archived == archived,
            )
            if role not in [Roles.owner.value, 'owner']:
                collab_ids_q = select(ProjectCollaborator.casting_id).where(ProjectCollaborator.user_id == user_id)
                base_query = base_query.where(
                    or_(Casting.owner_id == user_id, Casting.id.in_(collab_ids_q))
                )

            count_q = select(func.count()).select_from(base_query.subquery())
            total = (await session.execute(count_q)).scalar() or 0

            query = base_query.order_by(Casting.created_at.desc())
            query = query.offset((page - 1) * page_size).limit(page_size)
            result = await session.execute(query)
            castings = result.scalars().unique().all()

            projects = []
            for c in castings:
                sub_ids_result = await session.execute(
                    select(Casting.id).where(Casting.parent_project_id == c.id)
                )
                sub_ids = [row[0] for row in sub_ids_result.all()]
                all_ids = [c.id] + sub_ids
                sub_castings_count = len(sub_ids)
                resp_count = (await session.execute(
                    select(func.count()).where(Response.casting_id.in_(all_ids))
                )).scalar() or 0
                collaborator_count = (await session.execute(
                    select(func.count()).select_from(ProjectCollaborator).where(ProjectCollaborator.casting_id == c.id)
                )).scalar() or 0
                report_count = (await session.execute(
                    select(func.count()).select_from(Report).where(Report.casting_id.in_(all_ids))
                )).scalar() or 0
                image_url = await EmployerService._get_casting_image_url(session, c.id)

                published_at = None
                if c.post and c.post.published_at:
                    published_at = c.post.published_at

                projects.append({
                    "id": c.id,
                    "title": c.title,
                    "description": c.description,
                    "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                    "owner_id": getattr(c, 'owner_id', None) or 0,
                    "is_archived": bool(getattr(c, 'is_archived', False)),
                    "response_count": resp_count,
                    "sub_castings_count": sub_castings_count,
                    "collaborator_count": collaborator_count,
                    "team_size": collaborator_count + 1,
                    "report_count": report_count,
                    "image_url": image_url,
                    "published_at": published_at,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at,
                })

            return {"projects": projects, "total": total}

    @staticmethod
    async def set_project_archived(user_token: JWT, casting_id: int, archived: bool) -> dict:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting or getattr(casting, 'parent_project_id', None):
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            user_id = int(user_token.id)
            has_access = role in [Roles.owner.value, 'owner'] or getattr(casting, 'owner_id', None) == user_id
            if not has_access:
                collab = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == casting_id,
                        ProjectCollaborator.user_id == user_id,
                    )
                )
                has_access = collab.scalar_one_or_none() is not None
            if not has_access:
                raise HTTPException(status_code=403, detail="Not your project")

            casting.is_archived = archived
            casting.updated_at = datetime.now(timezone.utc)
            session.add(casting)
            await session.commit()
            await session.refresh(casting)

            try:
                await ActionLogService.log_event(
                    casting_id=casting.id,
                    user_id=user_id,
                    action_type='project_archived' if archived else 'project_restored',
                    message=f"Project {'archived' if archived else 'restored'}: {casting.title}",
                )
            except Exception:
                pass

            image_url = await EmployerService._get_casting_image_url(session, casting.id)
            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": getattr(casting, 'owner_id', 0),
                "is_archived": bool(casting.is_archived),
                "response_count": 0,
                "image_url": image_url,
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def get_project_by_id(user_token: JWT, casting_id: int) -> dict:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            user_id = int(user_token.id)
            role = user_token.role
            has_access = role in [Roles.owner.value, 'owner'] or getattr(casting, 'owner_id', None) == user_id
            if not has_access:
                collab = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == casting_id,
                        ProjectCollaborator.user_id == user_id,
                    )
                )
                has_access = collab.scalar_one_or_none() is not None
            if not has_access:
                parent_id = getattr(casting, 'parent_project_id', None)
                if parent_id:
                    parent = await session.get(Casting, parent_id)
                    if parent and getattr(parent, 'owner_id', None) == user_id:
                        has_access = True
                    if not has_access:
                        collab_parent = await session.execute(
                            select(ProjectCollaborator).where(
                                ProjectCollaborator.casting_id == parent_id,
                                ProjectCollaborator.user_id == user_id,
                            )
                        )
                        has_access = collab_parent.scalar_one_or_none() is not None
            if not has_access and role in [Roles.user.value, Roles.agent.value, 'user', 'agent']:
                has_access = (
                    casting.status == CastingStatusEnum.published
                    and not bool(getattr(casting, 'is_archived', False))
                )
            if not has_access:
                raise HTTPException(status_code=403, detail="Нет доступа")

            from reports.models import Report
            resp_count = (await session.execute(
                select(func.count()).where(Response.casting_id == casting_id)
            )).scalar() or 0
            image_url = await EmployerService._get_casting_image_url(session, casting_id, casting)

            published_at = None
            if casting.post and casting.post.published_at:
                published_at = casting.post.published_at

            publisher_name = None
            publisher_id = getattr(casting, 'published_by_id', None) or getattr(casting, 'owner_id', None)
            if publisher_id:
                publisher = await session.get(User, publisher_id)
                if publisher:
                    publisher_name = EmployerService._display_user_name(publisher, f"user#{publisher.id}")

            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": getattr(casting, 'owner_id', None) or 0,
                "parent_project_id": getattr(casting, 'parent_project_id', None),
                "is_archived": bool(getattr(casting, 'is_archived', False)),
                "response_count": resp_count,
                "image_url": image_url,
                "published_by": publisher_name,
                "published_by_id": publisher_id,
                "published_at": published_at,
                "created_at": casting.created_at,
                "city": casting.city,
                "project_category": casting.project_category,
                "role_types": casting.role_types,
                "gender": casting.gender,
                "age_from": casting.age_from,
                "age_to": casting.age_to,
                "financial_conditions": casting.financial_conditions,
                "shooting_dates": casting.shooting_dates,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def update_project(user_token: JWT, casting_id: int, title: Optional[str], description: Optional[str]) -> dict:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                from castings.models import ProjectCollaborator
                project_id = getattr(casting, 'parent_project_id', None) or casting_id
                collab_check = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == project_id,
                        ProjectCollaborator.user_id == int(user_token.id),
                    )
                )
                if not collab_check.scalar_one_or_none():
                    raise HTTPException(status_code=403, detail="You can only edit your own projects")

            if title:
                casting.title = title
            if description:
                casting.description = description
            await session.commit()
            try:
                await ActionLogService.log_event(
                    casting_id=casting.id,
                    user_id=int(user_token.id),
                    action_type='project_updated',
                    message=f"Project updated: {casting.title}",
                )
            except Exception:
                pass

            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": getattr(casting, 'owner_id', 0),
                "response_count": 0,
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def delete_project(user_token: JWT, casting_id: int) -> int:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                raise HTTPException(status_code=403, detail="You can only delete your own projects")

            deleted_title = casting.title
            await session.delete(casting)
            await session.commit()
            try:
                await ActionLogService.log_event(
                    casting_id=casting_id,
                    user_id=int(user_token.id),
                    action_type='project_deleted',
                    message=f"Project deleted: {deleted_title}",
                )
            except Exception:
                pass
            return casting_id

    @staticmethod
    async def publish_project(user_token: JWT, casting_id: int) -> dict:
        """
        Publish own project for employer/employer_pro (and owner).
        Once published, actors can see it in the feed.
        """
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                from castings.models import ProjectCollaborator
                collab_check = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == casting_id,
                        ProjectCollaborator.user_id == int(user_token.id),
                    )
                )
                if not collab_check.scalar_one_or_none():
                    raise HTTPException(status_code=403, detail="You can only publish your own projects")

            if casting.status == CastingStatusEnum.closed:
                raise HTTPException(status_code=400, detail="Closed project cannot be published")

            casting.status = CastingStatusEnum.published
            casting.is_archived = False
            casting.published_by_id = int(user_token.id)
            await session.commit()

            try:
                await ActionLogService.log_event(
                    casting_id=casting.id,
                    user_id=int(user_token.id),
                    action_type='project_published',
                    message=f"Project published: {casting.title}",
                )
            except Exception:
                pass

            try:
                pub_user = await session.get(User, int(user_token.id))
                pub_name = EmployerService._display_user_name(pub_user, f"User #{user_token.id}")
                await NotificationService.notify_superadmins(
                    type=NotificationType.CASTING_PUBLISHED,
                    title="Проект опубликован",
                    message=f"📢 {pub_name} опубликовал проект «{casting.title}».",
                    casting_id=casting.id,
                    exclude_user_id=int(user_token.id),
                )
                await NotificationService.notify_project_team(
                    casting_id=casting.id,
                    type=NotificationType.CASTING_PUBLISHED,
                    title="Кастинг открыт",
                    message=f"📢 {pub_name} открыл кастинг «{casting.title}».",
                    exclude_user_id=int(user_token.id),
                )
            except Exception:
                pass

            image_url = await EmployerService._get_casting_image_url(session, casting.id)

            published_at = None
            if casting.post and casting.post.published_at:
                published_at = casting.post.published_at

            await session.refresh(casting, attribute_names=['published_by'])
            publisher_name = None
            if casting.published_by:
                u = casting.published_by
                parts = [p for p in [u.first_name, u.last_name] if p]
                publisher_name = " ".join(parts) if parts else (u.email or f"user#{u.id}")

            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": getattr(casting, 'owner_id', 0),
                "is_archived": bool(getattr(casting, 'is_archived', False)),
                "response_count": 0,
                "image_url": image_url,
                "published_by": publisher_name,
                "published_at": published_at,
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def unpublish_project(user_token: JWT, casting_id: int) -> dict:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                from castings.models import ProjectCollaborator
                project_id = getattr(casting, 'parent_project_id', None) or casting_id
                collab_check = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == project_id,
                        ProjectCollaborator.user_id == int(user_token.id),
                    )
                )
                if not collab_check.scalar_one_or_none():
                    raise HTTPException(status_code=403, detail="Not your project")

            casting.status = CastingStatusEnum.unpublished
            await session.commit()

            try:
                actor = await session.get(User, int(user_token.id))
                actor_name = EmployerService._display_user_name(actor, f"User #{user_token.id}")
                await NotificationService.notify_project_team(
                    casting_id=casting.id,
                    type=NotificationType.CASTING_CLOSED,
                    title="Кастинг снят с публикации",
                    message=f"⏸ {actor_name} снял с публикации кастинг «{casting.title}».",
                    exclude_user_id=int(user_token.id),
                )
            except Exception:
                pass

            image_url = await EmployerService._get_casting_image_url(session, casting.id)

            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": getattr(casting, 'owner_id', 0),
                "is_archived": bool(getattr(casting, 'is_archived', False)),
                "response_count": 0,
                "image_url": image_url,
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def finish_project(user_token: JWT, casting_id: int) -> dict:
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                from castings.models import ProjectCollaborator
                project_id = getattr(casting, 'parent_project_id', None) or casting_id
                collab_check = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == project_id,
                        ProjectCollaborator.user_id == int(user_token.id),
                    )
                )
                if not collab_check.scalar_one_or_none():
                    raise HTTPException(status_code=403, detail="Not your project")

            casting.status = CastingStatusEnum.closed
            await session.commit()

            try:
                actor = await session.get(User, int(user_token.id))
                actor_name = EmployerService._display_user_name(actor, f"User #{user_token.id}")
                await NotificationService.notify_superadmins(
                    type=NotificationType.CASTING_CLOSED,
                    title="Проект закрыт",
                    message=f"{actor_name} закрыл проект «{casting.title}».",
                    casting_id=casting.id,
                    exclude_user_id=int(user_token.id),
                )
                await NotificationService.notify_project_team(
                    casting_id=casting.id,
                    type=NotificationType.CASTING_CLOSED,
                    title="Кастинг закрыт",
                    message=f"🔒 {actor_name} закрыл кастинг «{casting.title}».",
                    exclude_user_id=int(user_token.id),
                )
            except Exception:
                pass

            image_url = await EmployerService._get_casting_image_url(session, casting.id)

            return {
                "id": casting.id,
                "title": casting.title,
                "description": casting.description,
                "status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "owner_id": getattr(casting, 'owner_id', 0),
                "is_archived": bool(getattr(casting, 'is_archived', False)),
                "response_count": 0,
                "image_url": image_url,
                "created_at": casting.created_at,
                "updated_at": casting.updated_at,
            }

    @staticmethod
    async def get_respondents(user_token: JWT, casting_id: int, page: int = 1, page_size: int = 20) -> dict:
        """Employer видит актёров, откликнувшихся только на текущий кастинг."""
        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Project not found")

            role = user_token.role
            if role not in [Roles.owner.value, 'owner'] and getattr(casting, 'owner_id', None) != int(user_token.id):
                from castings.models import ProjectCollaborator
                collab_check = await session.execute(
                    select(ProjectCollaborator).where(
                        ProjectCollaborator.casting_id == casting_id,
                        ProjectCollaborator.user_id == int(user_token.id),
                    )
                )
                if not collab_check.scalar_one_or_none():
                    raise HTTPException(status_code=403, detail="You can only view respondents of your own projects")

            count_q = select(func.count()).where(Response.casting_id == casting_id)
            total = (await session.execute(count_q)).scalar() or 0

            query = (
                select(Response)
                .options(joinedload(Response.profile))
                .where(Response.casting_id == casting_id)
                .order_by(Response.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            result = await session.execute(query)
            responses = result.scalars().unique().all()

            from users.models import ActorProfile

            respondents = []
            for r in responses:
                p = r.profile
                if p:
                    photo = None
                    if hasattr(p, 'images') and p.images:
                        photo = p.images[0].crop_photo_url or p.images[0].photo_url

                    age = None
                    if p.date_of_birth:
                        today = datetime.now().date()
                        age = today.year - p.date_of_birth.year

                    ap_result = await session.execute(
                        select(ActorProfile).where(
                            ActorProfile.user_id == p.user_id,
                            ActorProfile.is_deleted == False,
                        ).order_by(ActorProfile.created_at.desc()).limit(1)
                    )
                    ap = ap_result.unique().scalar_one_or_none()

                    media_assets = []
                    ap_photo = None
                    ap_photo_fallback = None
                    if ap and ap.media_assets:
                        for m in ap.media_assets:
                            media_assets.append({
                                "id": m.id,
                                "file_type": m.file_type,
                                "original_url": m.original_url,
                                "processed_url": m.processed_url,
                                "thumbnail_url": m.thumbnail_url,
                                "is_primary": m.is_primary,
                            })
                            if m.file_type == "photo":
                                if m.is_primary:
                                    ap_photo = m.processed_url or m.original_url
                                elif ap_photo_fallback is None:
                                    ap_photo_fallback = m.processed_url or m.original_url
                    if not ap_photo:
                        ap_photo = ap_photo_fallback

                    avg_r = None
                    r_count = 0
                    try:
                        from crm.models import ActorReview
                        avg_r = (await session.execute(
                            select(func.avg(ActorReview.rating)).where(ActorReview.profile_id == p.id)
                        )).scalar()
                        r_count = (await session.execute(
                            select(func.count()).where(ActorReview.profile_id == p.id)
                        )).scalar() or 0
                    except Exception:
                        pass

                    owner_user = await session.get(User, p.user_id) if p.user_id else None
                    is_banned = owner_user and not owner_user.is_active
                    is_agent_owner = owner_user and str(
                        owner_user.role.value if hasattr(owner_user.role, 'value') else owner_user.role
                    ) == 'agent'

                    if is_banned:
                        contact_phone = None
                        contact_email = None
                        has_agent = False
                        agent_name_r = None
                    elif is_agent_owner:
                        name_parts = [x for x in [owner_user.first_name, owner_user.last_name] if x]
                        contact_phone = owner_user.phone_number
                        contact_email = owner_user.email
                        has_agent = True
                        agent_name_r = " ".join(name_parts) if name_parts else (owner_user.email or "Агент")
                    else:
                        contact_phone = (ap.phone_number if ap else None) or p.phone_number
                        contact_email = (ap.email if ap else None) or p.email
                        has_agent = False
                        agent_name_r = None

                    respondents.append({
                        "profile_id": p.id,
                        "response_id": r.id,
                        "response_status": getattr(r, 'status', 'pending') or 'pending',
                        "actor_profile_id": ap.id if ap else None,
                        "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                        "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                        "display_name": ap.display_name if ap else None,
                        "gender": p.gender.value if hasattr(p.gender, 'value') else str(p.gender) if p.gender else (ap.gender if ap else None),
                        "date_of_birth": str(ap.date_of_birth) if ap and ap.date_of_birth else (str(p.date_of_birth) if p.date_of_birth else None),
                        "city": (ap.city if ap and ap.city else None) or (str(p.city_full) if p.city_full else None),
                        "age": age,
                        "phone_number": contact_phone,
                        "email": contact_email,
                        "has_agent": has_agent,
                        "agent_name": agent_name_r,
                        "is_banned": bool(is_banned),
                        "qualification": p.qualification.value if hasattr(p.qualification, 'value') else str(p.qualification) if p.qualification else (ap.qualification if ap else None),
                        "experience": (ap.experience if ap else None) or p.experience,
                        "about_me": (ap.about_me if ap else None) or p.about_me,
                        "look_type": ap.look_type if ap else (p.look_type.value if hasattr(p, 'look_type') and p.look_type and hasattr(p.look_type, 'value') else None),
                        "hair_color": ap.hair_color if ap else (p.hair_color.value if hasattr(p, 'hair_color') and p.hair_color and hasattr(p.hair_color, 'value') else None),
                        "hair_length": ap.hair_length if ap else (p.hair_length.value if hasattr(p, 'hair_length') and p.hair_length and hasattr(p.hair_length, 'value') else None),
                        "height": ap.height if ap else (float(p.height) if p.height else None),
                        "clothing_size": (ap.clothing_size if ap else None) or (str(p.clothing_size) if p.clothing_size else None),
                        "shoe_size": (ap.shoe_size if ap else None) or (str(p.shoe_size) if p.shoe_size else None),
                        "bust_volume": ap.bust_volume if ap else (float(p.bust_volume) if p.bust_volume else None),
                        "waist_volume": ap.waist_volume if ap else (float(p.waist_volume) if p.waist_volume else None),
                        "hip_volume": ap.hip_volume if ap else (float(p.hip_volume) if p.hip_volume else None),
                        "video_intro": (ap.video_intro if ap else None) or p.video_intro,
                        "trust_score": ap.trust_score if ap else 0,
                        "photo_url": ap_photo or photo,
                        "media_assets": media_assets,
                        "responded_at": r.created_at,
                        "self_test_url": r.self_test_url,
                        "avg_rating": round(float(avg_r), 1) if avg_r else 5.0,
                        "review_count": r_count,
                    })

            return {
                "respondents": respondents,
                "total": total,
                "project_title": casting.title,
            }


    @staticmethod
    async def get_all_actors(user_token: JWT, page: int = 1, page_size: int = 20, search: Optional[str] = None) -> dict:
        """АдминПРО: просмотр ВСЕХ актёров в базе (не только откликнувшихся)."""
        role = user_token.role
        allowed = [Roles.owner.value, 'owner', Roles.employer_pro.value, 'employer_pro',
                   Roles.administrator.value, 'administrator', Roles.manager.value, 'manager']
        if role not in allowed:
            raise HTTPException(status_code=403, detail="Only AdminPro or higher can view all actors")

        from users.models import ActorProfile

        async with async_session() as session:
            base = select(Profile).where(Profile.first_name.isnot(None))

            if search:
                base = base.where(
                    Profile.first_name.ilike(f"%{search}%") |
                    Profile.last_name.ilike(f"%{search}%")
                )

            count_q = select(func.count()).select_from(base.subquery())
            total = (await session.execute(count_q)).scalar() or 0

            query = base.order_by(Profile.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
            result = await session.execute(query)
            profiles = result.unique().scalars().all()

            actors = []
            for p in profiles:
                photo = None
                if hasattr(p, 'images') and p.images:
                    photo = p.images[0].crop_photo_url or p.images[0].photo_url

                age = None
                if p.date_of_birth:
                    today = datetime.now().date()
                    age = today.year - p.date_of_birth.year

                ap_result = await session.execute(
                    select(ActorProfile).where(
                        ActorProfile.user_id == p.user_id,
                        ActorProfile.is_deleted == False,
                    ).order_by(ActorProfile.created_at.desc()).limit(1)
                )
                ap = ap_result.unique().scalar_one_or_none()

                media_assets = []
                ap_photo = None
                ap_photo_fallback = None
                if ap and ap.media_assets:
                    for m in ap.media_assets:
                        media_assets.append({
                            "id": m.id,
                            "file_type": m.file_type,
                            "original_url": m.original_url,
                            "processed_url": m.processed_url,
                            "thumbnail_url": m.thumbnail_url,
                            "is_primary": m.is_primary,
                        })
                        if m.file_type == "photo":
                            if m.is_primary:
                                ap_photo = m.processed_url or m.original_url
                            elif ap_photo_fallback is None:
                                ap_photo_fallback = m.processed_url or m.original_url
                if not ap_photo:
                    ap_photo = ap_photo_fallback

                avg_r = None
                r_count = 0
                try:
                    from crm.models import ActorReview
                    avg_r = (await session.execute(
                        select(func.avg(ActorReview.rating)).where(ActorReview.profile_id == p.id)
                    )).scalar()
                    r_count = (await session.execute(
                        select(func.count()).where(ActorReview.profile_id == p.id)
                    )).scalar() or 0
                except Exception:
                    pass

                owner_user = await session.get(User, p.user_id) if p.user_id else None
                is_banned = owner_user and not owner_user.is_active
                is_agent_owner2 = owner_user and str(
                    owner_user.role.value if hasattr(owner_user.role, 'value') else owner_user.role
                ) == 'agent'

                if is_banned:
                    contact_phone2 = None
                    contact_email2 = None
                    has_agent2 = False
                    agent_name2 = None
                elif is_agent_owner2:
                    name_parts2 = [x for x in [owner_user.first_name, owner_user.last_name] if x]
                    contact_phone2 = owner_user.phone_number
                    contact_email2 = owner_user.email
                    has_agent2 = True
                    agent_name2 = " ".join(name_parts2) if name_parts2 else (owner_user.email or "Агент")
                else:
                    contact_phone2 = (ap.phone_number if ap else None) or p.phone_number
                    contact_email2 = (ap.email if ap else None) or p.email
                    has_agent2 = False
                    agent_name2 = None

                actors.append({
                    "profile_id": p.id,
                    "actor_profile_id": ap.id if ap else None,
                    "first_name": (ap.first_name if ap and ap.first_name else None) or p.first_name,
                    "last_name": (ap.last_name if ap and ap.last_name else None) or p.last_name,
                    "display_name": ap.display_name if ap else None,
                    "gender": p.gender.value if hasattr(p.gender, 'value') else str(p.gender) if p.gender else (ap.gender if ap else None),
                    "date_of_birth": str(ap.date_of_birth) if ap and ap.date_of_birth else (str(p.date_of_birth) if p.date_of_birth else None),
                    "city": (ap.city if ap and ap.city else None) or (str(p.city_full) if p.city_full else None),
                    "age": age,
                    "phone_number": contact_phone2,
                    "email": contact_email2,
                    "has_agent": has_agent2,
                    "agent_name": agent_name2,
                    "is_banned": bool(is_banned),
                    "qualification": p.qualification.value if hasattr(p.qualification, 'value') else str(p.qualification) if p.qualification else (ap.qualification if ap else None),
                    "experience": (ap.experience if ap else None) or p.experience,
                    "about_me": (ap.about_me if ap else None) or p.about_me,
                    "look_type": ap.look_type if ap else None,
                    "hair_color": ap.hair_color if ap else None,
                    "height": ap.height if ap else (float(p.height) if p.height else None),
                    "clothing_size": (ap.clothing_size if ap else None) or (str(p.clothing_size) if p.clothing_size else None),
                    "shoe_size": (ap.shoe_size if ap else None) or (str(p.shoe_size) if p.shoe_size else None),
                    "photo_url": ap_photo or photo,
                    "media_assets": media_assets,
                    "responded_at": p.created_at,
                    "avg_rating": round(float(avg_r), 1) if avg_r else 5.0,
                    "review_count": r_count,
                })

            return {"respondents": actors, "total": total, "project_title": "All Actors (Pro)"}


class ActorFeedService:
    """Сервис для актёра — лента проектов, отклики, история."""

    @staticmethod
    async def _get_or_create_response_profile(session, user_token: JWT):
        user_id = int(user_token.id)

        legacy_result = await session.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        legacy_profile = legacy_result.unique().scalar_one_or_none()
        if legacy_profile:
            return legacy_profile

        from users.models import ActorProfile

        actor_profile_query = (
            select(ActorProfile)
            .where(
                ActorProfile.user_id == user_id,
                ActorProfile.is_deleted == False,
            )
            .order_by(
                (ActorProfile.id == int(user_token.profile_id)).desc() if user_token.profile_id else ActorProfile.created_at.desc(),
                ActorProfile.created_at.desc(),
            )
            .limit(1)
        )
        actor_profile = (await session.execute(actor_profile_query)).scalar_one_or_none()
        if not actor_profile:
            return None

        legacy_profile = Profile(
            user_id=user_id,
            first_name=actor_profile.first_name,
            last_name=actor_profile.last_name,
            about_me=actor_profile.about_me,
            video_intro=actor_profile.video_intro,
        )
        session.add(legacy_profile)
        await session.flush()
        return legacy_profile

    @staticmethod
    async def get_feed(page: int = 1, page_size: int = 20) -> dict:
        """Лента опубликованных проектов для актёра."""
        async with async_session() as session:
            from castings.enums import CastingStatusEnum
            from sqlalchemy.orm import selectinload

            base = select(Casting).where(
                Casting.status == CastingStatusEnum.published,
                Casting.is_archived == False,
            )
            count_q = select(func.count()).select_from(base.subquery())
            total = (await session.execute(count_q)).scalar() or 0

            query = (
                base
                .options(selectinload(Casting.published_by))
                .order_by(Casting.created_at.desc())
                .offset((page - 1) * page_size)
                .limit(page_size)
            )
            result = await session.execute(query)
            castings = result.unique().scalars().all()

            projects = []
            for c in castings:
                publisher_name = None
                publisher_id = None

                # Prefer published_by, fallback to owner
                if c.published_by_id and c.published_by:
                    u = c.published_by
                    parts = [p for p in [u.first_name, u.last_name] if p]
                    publisher_name = " ".join(parts) if parts else (u.email or f"user#{u.id}")
                    publisher_id = c.published_by_id
                elif c.owner_id:
                    owner = await session.get(User, c.owner_id)
                    if owner:
                        parts = [p for p in [owner.first_name, owner.last_name] if p]
                        publisher_name = " ".join(parts) if parts else (owner.email or f"user#{owner.id}")
                        publisher_id = owner.id

                projects.append({
                    "id": c.id,
                    "title": c.title,
                    "description": c.description,
                    "status": c.status.value if hasattr(c.status, 'value') else str(c.status),
                    "image_url": await EmployerService._get_casting_image_url(session, c.id, casting=c),
                    "published_by": publisher_name,
                    "published_by_id": publisher_id,
                    "created_at": c.created_at,
                    "city": c.city,
                    "project_category": c.project_category,
                    "role_types": c.role_types,
                    "gender": c.gender,
                    "age_from": c.age_from,
                    "age_to": c.age_to,
                    "financial_conditions": c.financial_conditions,
                    "shooting_dates": c.shooting_dates,
                })

            return {"projects": projects, "total": total}

    @staticmethod
    async def respond_to_casting(user_token: JWT, casting_id: int, self_test_url: Optional[str] = None) -> dict:
        """Актёр откликается на проект."""
        async with async_session() as session:
            profile = await ActorFeedService._get_or_create_response_profile(session, user_token)
            if not profile:
                raise HTTPException(status_code=400, detail="Сначала создайте профиль актёра")
            profile_id = profile.id

            existing = await session.execute(
                select(Response).where(
                    and_(Response.profile_id == profile_id, Response.casting_id == casting_id)
                )
            )
            if existing.unique().scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Already responded to this casting")

            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Casting not found")

            from datetime import datetime, timezone
            response = Response(
                profile_id=profile_id,
                casting_id=casting_id,
                self_test_url=self_test_url,
            )
            session.add(response)
            await session.commit()
            await session.refresh(response)
            try:
                owner_id = getattr(casting, 'owner_id', None)
                if owner_id:
                    await NotificationService.create(
                        user_id=int(owner_id),
                        type=NotificationType.NEW_RESPONSE,
                        title="Новый отклик на проект",
                        message=f"Поступил новый отклик на проект: {casting.title}",
                        casting_id=casting_id,
                        profile_id=profile_id,
                    )
                await ActionLogService.log_event(
                    casting_id=casting_id,
                    user_id=int(user_token.id),
                    action_type='response_sent',
                    message=f"Actor profile #{profile_id} responded to project",
                )
            except Exception:
                pass

            return {
                "id": response.id,
                "casting_id": casting_id,
                "casting_title": casting.title,
                "casting_description": casting.description,
                "casting_status": casting.status.value if hasattr(casting.status, 'value') else str(casting.status),
                "response_status": response.status or "pending",
                "self_test_url": self_test_url,
                "responded_at": response.created_at or datetime.now(timezone.utc),
            }

    @staticmethod
    async def agent_respond_to_casting(user_token: JWT, casting_id: int, profile_ids: list[int]) -> dict:
        """Агент откликает несколько своих актёров на кастинг."""
        from users.models import ActorProfile
        import json as _json

        user_id = int(user_token.id)

        async with async_session() as session:
            casting = await session.get(Casting, casting_id)
            if not casting:
                raise HTTPException(status_code=404, detail="Casting not found")

            ap_result = await session.execute(
                select(ActorProfile).where(
                    ActorProfile.id.in_(profile_ids),
                    ActorProfile.user_id == user_id,
                    ActorProfile.is_deleted == False,
                )
            )
            valid_profiles = {ap.id: ap for ap in ap_result.scalars().all()}
            if not valid_profiles:
                raise HTTPException(status_code=400, detail="Нет валидных профилей для отклика")

            legacy_q = await session.execute(
                select(Profile).where(Profile.user_id == user_id)
            )
            legacy_profile = legacy_q.unique().scalar_one_or_none()

            if not legacy_profile:
                first_ap = next(iter(valid_profiles.values()))
                legacy_profile = Profile(
                    user_id=user_id,
                    first_name=first_ap.first_name,
                    last_name=first_ap.last_name,
                )
                session.add(legacy_profile)
                await session.flush()

            existing_resp = await session.execute(
                select(Response).where(
                    and_(Response.profile_id == legacy_profile.id, Response.casting_id == casting_id)
                )
            )
            already_responded = existing_resp.unique().scalar_one_or_none() is not None

            valid_ids = [ap_id for ap_id in profile_ids if ap_id in valid_profiles]

            results = []
            if already_responded:
                for ap_id in valid_ids:
                    ap = valid_profiles[ap_id]
                    results.append({
                        "profile_id": ap_id,
                        "first_name": ap.first_name,
                        "last_name": ap.last_name,
                        "status": "already_responded",
                    })
            else:
                response = Response(
                    profile_id=legacy_profile.id,
                    casting_id=casting_id,
                    self_test_url=_json.dumps(valid_ids),
                )
                session.add(response)
                await session.flush()

                for ap_id in profile_ids:
                    ap = valid_profiles.get(ap_id)
                    if not ap:
                        continue
                    results.append({
                        "profile_id": ap_id,
                        "first_name": ap.first_name,
                        "last_name": ap.last_name,
                        "status": "ok",
                        "response_id": response.id,
                    })

            await session.commit()

            try:
                owner_id = getattr(casting, 'owner_id', None)
                actor_names = ", ".join(
                    f"{r['first_name']} {r.get('last_name', '')}".strip()
                    for r in results if r.get("status") == "ok"
                )
                if owner_id and actor_names:
                    await NotificationService.create(
                        user_id=int(owner_id),
                        type=NotificationType.NEW_RESPONSE,
                        title="Новые отклики (через агента)",
                        message=f"Агент откликнул актёров на проект «{casting.title}»: {actor_names}",
                        casting_id=casting_id,
                    )
            except Exception:
                pass

            return {
                "casting_id": casting_id,
                "casting_title": casting.title,
                "results": results,
                "total_submitted": sum(1 for r in results if r.get("status") == "ok"),
            }

    @staticmethod
    async def get_my_responses(user_token: JWT) -> dict:
        """История откликов актёра."""
        from reports.models import ProfilesReports
        from castings.enums import CastingStatusEnum
        from sqlalchemy import text

        async with async_session() as session:
            profile = await ActorFeedService._get_or_create_response_profile(session, user_token)
            if not profile:
                return {"responses": [], "total": 0}

            query = (
                select(Response)
                .options(joinedload(Response.casting))
                .where(Response.profile_id == profile.id)
                .order_by(Response.created_at.desc())
            )
            result = await session.execute(query)
            responses = result.scalars().unique().all()

            is_globally_favorited = False
            try:
                fav_r = await session.execute(
                    text("SELECT 1 FROM employer_favorites WHERE profile_id = :pid LIMIT 1"),
                    {"pid": profile.id},
                )
                is_globally_favorited = fav_r.first() is not None
            except Exception:
                pass

            pr_result = await session.execute(
                select(ProfilesReports).where(ProfilesReports.profile_id == profile.id)
            )
            report_entries = pr_result.scalars().all()
            in_report_casting_ids = {pr.report_id: pr for pr in report_entries}
            report_favorite_casting_ids: set[int] = set()
            in_report_for_casting: set[int] = set()
            for pr in report_entries:
                from reports.models import Report
                rpt = await session.get(Report, pr.report_id)
                if rpt:
                    in_report_for_casting.add(rpt.casting_id)
                    if getattr(pr, 'favorite', False):
                        report_favorite_casting_ids.add(rpt.casting_id)

            from users.models import ActorProfile
            from actor_profiles.service import ActorProfileService
            import json as _json

            all_actor_ids: set[int] = set()
            response_actor_ids_map: dict[int, list[int]] = {}
            for r in responses:
                try:
                    ids = _json.loads(r.self_test_url) if r.self_test_url else []
                    if isinstance(ids, list):
                        response_actor_ids_map[r.id] = ids
                        all_actor_ids.update(ids)
                except Exception:
                    response_actor_ids_map[r.id] = []

            actor_map: dict[int, dict] = {}
            if all_actor_ids:
                ap_q = await session.execute(
                    select(ActorProfile).where(ActorProfile.id.in_(all_actor_ids))
                )
                for ap in ap_q.scalars().all():
                    primary_photo = None
                    for m in (ap.media_assets or []):
                        if m.file_type == 'photo':
                            if m.is_primary:
                                primary_photo = m.processed_url or m.original_url
                                break
                            elif not primary_photo:
                                primary_photo = m.processed_url or m.original_url
                    actor_map[ap.id] = {
                        "id": ap.id,
                        "first_name": ap.first_name,
                        "last_name": ap.last_name,
                        "primary_photo": primary_photo,
                        "city": ap.city,
                        "gender": ap.gender,
                    }

            items = []
            for r in responses:
                c = r.casting
                casting_status_val = c.status.value if c and hasattr(c.status, 'value') else str(c.status) if c else "unknown"

                if c and c.status == CastingStatusEnum.closed:
                    actor_status = 'rejected'
                    actor_status_label = 'Отклонено'
                elif is_globally_favorited or (c and c.id in report_favorite_casting_ids):
                    actor_status = 'favorited'
                    actor_status_label = 'В избранном'
                elif c and c.id in in_report_for_casting:
                    actor_status = 'in_review'
                    actor_status_label = 'На рассмотрении'
                else:
                    actor_status = 'pending'
                    actor_status_label = 'Ожидает'

                actors = [actor_map[aid] for aid in response_actor_ids_map.get(r.id, []) if aid in actor_map]

                items.append({
                    "id": r.id,
                    "casting_id": r.casting_id,
                    "casting_title": c.title if c else "Unknown",
                    "casting_description": c.description if c else None,
                    "casting_status": casting_status_val,
                    "casting_created_at": c.created_at if c else None,
                    "image_url": await EmployerService._get_casting_image_url(session, c.id, casting=c) if c else None,
                    "response_status": getattr(r, 'status', 'pending') or 'pending',
                    "actor_status": actor_status,
                    "actor_status_label": actor_status_label,
                    "actors": actors,
                    "responded_at": r.created_at,
                })

            return {"responses": items, "total": len(items)}
