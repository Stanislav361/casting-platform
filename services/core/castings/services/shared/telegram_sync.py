"""
Casting Telegram Channel Sync Service.

Idempotent, fault-tolerant bridge between casting lifecycle (employer/admin flows)
and a Telegram channel (settings.TG_CHANEL_NAME).

Design principles:
- DB is the source of truth. Telegram delivery is best-effort: a failed publish/edit/delete
  must NEVER break the user-facing operation (status changes are already persisted).
- Idempotency: every operation checks `casting_posts` first to avoid duplicate posts or
  redundant Telegram API calls.
- Graceful degradation: if `TG_CHANEL_NAME` is not configured, every method becomes a no-op.
- Single chat: all posts go to the configured channel; if `chat_id` of an existing post
  diverges, we fall back to legacy behaviour for that record.

Public API:
- `is_configured()`: bool
- `publish(session, casting_id, *, commit=True)`: create new TG post (or return existing)
- `unpublish(session, casting_id, *, commit=True)`: delete TG post + casting_posts row
- `close(session, casting_id, *, commit=True)`: reply 'Кастинг завершён' + mark closed_at
- `edit(session, casting_id, *, commit=True)`: best-effort caption/text update
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from castings.models import Casting, TelegramPost
from castings.services.admin.telegram.channel.templates.types.buttons import CastingPostButton
from config import settings
from shared.services.telegram.channel.service import TelegramChannelService
from shared.services.telegram.channel.templates.types.post import ChannelPostText

try:
    from aiogram.exceptions import TelegramAPIError, TelegramBadRequest
except ImportError:  # pragma: no cover - aiogram <3 fallback
    TelegramAPIError = Exception  # type: ignore
    TelegramBadRequest = Exception  # type: ignore

logger = logging.getLogger(__name__)


CAPTION_LIMIT = 1024  # Telegram limit for sendPhoto caption / editMessageCaption
TEXT_LIMIT = 4000  # Telegram limit for sendMessage / editMessageText (4096, leave a margin)


# ──────────────────────────────────────────────────────────────────────────────
#   POST TEXT BUILDER
# ──────────────────────────────────────────────────────────────────────────────

def _escape_html(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _format_age(casting: Casting) -> Optional[str]:
    age_from = getattr(casting, "age_from", None)
    age_to = getattr(casting, "age_to", None)
    if age_from and age_to:
        return f"{age_from}–{age_to} лет"
    if age_from:
        return f"от {age_from} лет"
    if age_to:
        return f"до {age_to} лет"
    return None


def _format_role_types(casting: Casting) -> Optional[str]:
    raw = getattr(casting, "role_types", None)
    if not raw:
        return None
    if isinstance(raw, list):
        items = [str(x).strip() for x in raw if str(x).strip()]
        return ", ".join(items) if items else None
    return str(raw)


def _truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    ellipsis = "…"
    return text[: max(0, limit - len(ellipsis))].rstrip() + ellipsis


def _clean_dates(dates_str: str) -> str:
    if not dates_str:
        return ""
    s = dates_str.strip()
    import re
    # Remove leading cyrillic 'с', 'по', 'c', or latin 'c' (with optional spaces)
    s = re.sub(r'^[сссcс]\s+', '', s, flags=re.IGNORECASE)
    s = re.sub(r'^по\s+', '', s, flags=re.IGNORECASE)
    s = re.sub(r'^[сc]\s*', '', s, flags=re.IGNORECASE)
    s = re.sub(r'^до\s*', '', s, flags=re.IGNORECASE)
    return s.strip()


def _format_finance(finance_str: str) -> str:
    if not finance_str:
        return ""
    s = finance_str.strip()
    if s.lower() == "обсуждаются индивидуально":
        return s

    import re
    # Extract only the digits
    digits_only = "".join(re.findall(r'\d+', s))
    if digits_only:
        # If the string is mostly digits and currency words, convert to "X₽/смена"
        # Check if the remaining part after removing digits is just currency-related words
        remain = re.sub(r'\d+', '', s).strip().lower()
        remain = re.sub(r'[\s\xa0\.,/\\_]+', '', remain)
        # Currency/shift indicators
        valid_remainders = {
            "", "руб", "рублей", "р", "₽", "засмену", "смена", "смену", "рублейзасмену", "рзасмену", "₽засмену", "рсмена", "рубсмена", "₽смена"
        }
        if remain in valid_remainders:
            return f"{digits_only}₽/смена"

    # General fallback
    return s


def build_casting_post_text(casting: Casting, *, has_image: bool) -> str:
    """Build a rich HTML-formatted post body for a casting.

    Layout:
        <u><b>Title</b></u>

        <b>Норильск</b>
        <b>Сериал • АМС</b>
        <b>Девочка • 11-14 лет</b>
        <b>24.06.2026.</b>
        <b>3400₽/смена.</b>

        Описание (truncated to fit Telegram limit)
    """

    title = _escape_html(getattr(casting, "title", "")).strip()
    description_raw = getattr(casting, "description", "") or ""

    meta_lines: list[str] = []

    # 1. City (First)
    city = _escape_html(getattr(casting, "city", None)).strip()
    if city:
        meta_lines.append(f"<b>{city}</b>")

    # 2. Project Category and Roles (Second)
    category = _escape_html(getattr(casting, "project_category", None)).strip()
    roles = _escape_html(_format_role_types(casting))
    if category and roles:
        meta_lines.append(f"<b>{category} • {roles}</b>")
    elif category:
        meta_lines.append(f"<b>{category}</b>")
    elif roles:
        meta_lines.append(f"<b>{roles}</b>")

    # 3. Gender and Age (Third)
    gender = _escape_html(getattr(casting, "gender", None)).strip()
    age = _format_age(casting)
    if gender and age:
        meta_lines.append(f"<b>{gender} • {age}</b>")
    elif gender:
        meta_lines.append(f"<b>{gender}</b>")
    elif age:
        meta_lines.append(f"<b>{age}</b>")

    # 4. Dates (Fourth)
    dates_raw = getattr(casting, "shooting_dates", None) or ""
    dates = _escape_html(_clean_dates(dates_raw))
    if dates:
        if not dates.endswith("."):
            dates = f"{dates}."
        meta_lines.append(f"<b>{dates}</b>")

    # 5. Fee (Fifth)
    finance_raw = getattr(casting, "financial_conditions", None) or ""
    finance = _escape_html(_format_finance(finance_raw))
    if finance:
        if not finance.endswith("."):
            finance = f"{finance}."
        meta_lines.append(f"<b>{finance}</b>")

    header = f"<u><b>{title}</b></u>" if title else ""
    meta_block = "\n".join(meta_lines)

    # Strip basic HTML tags from description to keep telegram-friendly text.
    # Existing admin-flow descriptions may contain <p>/<b>/<i> — we keep those
    # whitelisted by Telegram, but normalise paragraph breaks.
    description = description_raw.replace("\r\n", "\n").replace("\r", "\n").strip()
    # Replace <p>...</p> with the inner text + double newline
    import re

    description = re.sub(r"</p>\s*<p>", "\n\n", description)
    description = re.sub(r"</?p>", "", description)
    description = re.sub(r"<br\s*/?>", "\n", description)
    description = re.sub(r"\n{3,}", "\n\n", description).strip()

    parts = [p for p in [header, meta_block, description] if p]
    full_text = "\n\n".join(parts)

    limit = CAPTION_LIMIT if has_image else TEXT_LIMIT
    return _truncate(full_text, limit)


def build_close_post_text(casting: Casting) -> str:
    title = _escape_html(getattr(casting, "title", "")).strip()
    if title:
        return f"<b>{title}</b>\n\nКастинг завершён ✅"
    return "Кастинг завершён ✅"


class _StaticText(ChannelPostText):
    """Lightweight ChannelPostText impl that returns a pre-built string."""

    def __init__(self, text: str):
        self._text = text

    def get_message(self, *args, **kwargs) -> str:
        return self._text


class _CastingIdHolder:
    """Tiny duck-type for CastingPostButton when only id is needed."""

    __slots__ = ("id",)

    def __init__(self, casting_id: int):
        self.id = casting_id


# ──────────────────────────────────────────────────────────────────────────────
#   SYNC SERVICE
# ──────────────────────────────────────────────────────────────────────────────


class CastingTelegramSyncService:
    """Idempotent orchestration of Telegram channel posts for castings.

    Every method is safe to call multiple times — duplicate publish requests
    return the existing post, redundant deletes are no-ops, and Telegram
    failures are logged but do not raise to callers (publish exceptions are
    captured to `last_error` for diagnostics if needed).
    """

    last_error: Optional[Exception] = None

    @staticmethod
    def is_configured() -> bool:
        channel = getattr(settings, "TG_CHANEL_NAME", "") or ""
        token = getattr(settings, "TG_BOT_TOKEN", "") or ""
        return bool(channel.strip()) and bool(token.strip())

    @staticmethod
    async def _load_casting(session: AsyncSession, casting_id: int) -> Optional[Casting]:
        result = await session.execute(
            select(Casting)
            .options(selectinload(Casting.image), selectinload(Casting.post))
            .where(Casting.id == casting_id)
        )
        return result.unique().scalar_one_or_none()

    @staticmethod
    async def _existing_post(session: AsyncSession, casting_id: int) -> Optional[TelegramPost]:
        result = await session.execute(
            select(TelegramPost).where(TelegramPost.casting_id == casting_id)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _fallback_cover_url(casting: Casting) -> Optional[str]:
        """Return the same deterministic fallback cover as the PWA.

        Frontend logic lives in `shared/fallback-cover.ts`:
        `getCoverImage(imageUrl, casting.id || casting.title)` → if no real
        image, use `/fallback-covers/{01..12}.png` based on a JS 32-bit rolling
        hash. Telegram must use the same cover so channel posts visually match
        the casting page even when no custom image was uploaded.
        """
        base_url = (getattr(settings, "PUBLIC_WEB_URL", "") or "").strip().rstrip("/")
        if not base_url:
            return None

        seed = str(getattr(casting, "id", None) or getattr(casting, "title", "") or "fallback-cover")
        h = 0
        for char in seed:
            h = ((h * 31) + ord(char)) & 0xFFFFFFFF
        index = (h % 12) + 1
        return f"{base_url}/fallback-covers/{index:02d}.png"

    @classmethod
    def _resolve_image_url(cls, casting: Casting) -> Optional[str]:
        """Pick the image shown by the PWA: real cover first, fallback second."""
        if casting.image:
            sorted_images = sorted(
                casting.image,
                key=lambda img: (
                    getattr(img, "updated_at", None) or datetime.min.replace(tzinfo=timezone.utc),
                    getattr(img, "created_at", None) or datetime.min.replace(tzinfo=timezone.utc),
                ),
                reverse=True,
            )
            real_url = next((img.photo_url for img in sorted_images if img.photo_url), None)
            if real_url:
                return real_url
        return cls._fallback_cover_url(casting)

    @classmethod
    async def publish(
        cls,
        session: AsyncSession,
        casting_id: int,
        *,
        commit: bool = True,
    ) -> Optional[TelegramPost]:
        """Send (or reuse) a channel post for the casting. Idempotent."""
        cls.last_error = None
        if not cls.is_configured():
            return None

        existing = await cls._existing_post(session, casting_id)
        if existing:
            # Пост уже есть — освежаем кнопку «Откликнуться» на актуальную
            # ссылку (например, после перехода со старой ссылки на бота к
            # прямой ссылке в PWA) без пересоздания сообщения. Best-effort.
            try:
                channel = TelegramChannelService(
                    button=CastingPostButton(casting=_CastingIdHolder(casting_id)),
                )
                await channel.edit_post_reply_markup(existing.message_id)
            except TelegramBadRequest as exc:
                if "message is not modified" not in str(exc).lower():
                    logger.info(
                        "TelegramSync.publish: button refresh skipped for casting %s: %s",
                        casting_id, exc,
                    )
            except Exception as exc:
                logger.warning(
                    "TelegramSync.publish: failed to refresh button for casting %s: %s",
                    casting_id, exc,
                )
            return existing

        casting = await cls._load_casting(session, casting_id)
        if not casting:
            logger.warning("TelegramSync.publish: casting %s not found", casting_id)
            return None

        image_url = cls._resolve_image_url(casting)
        try:
            has_image = bool(image_url)
            text = build_casting_post_text(casting, has_image=has_image)
            keyboard = CastingPostButton(casting=_CastingIdHolder(casting.id))
            channel = TelegramChannelService(post_text=_StaticText(text), button=keyboard)

            if has_image:
                try:
                    message = await channel.send_post_with_image(image_url=image_url)
                except Exception as image_exc:
                    logger.warning(
                        "TelegramSync.publish: photo send failed for casting %s (%s), falling back to text post",
                        casting_id,
                        image_exc,
                        exc_info=True,
                    )
                    text = build_casting_post_text(casting, has_image=False)
                    channel = TelegramChannelService(post_text=_StaticText(text), button=keyboard)
                    message = await channel.send_post_without_image()
            else:
                message = await channel.send_post_without_image()
        except TelegramAPIError as exc:
            cls.last_error = exc
            logger.error(
                "TelegramSync.publish failed for casting %s: %s", casting_id, exc, exc_info=True
            )
            return None
        except Exception as exc:  # network/value/typing edge cases
            cls.last_error = exc
            logger.error(
                "TelegramSync.publish unexpected error for casting %s: %s",
                casting_id,
                exc,
                exc_info=True,
            )
            return None

        username = getattr(message.chat, "username", None)
        if username:
            post_url = f"https://t.me/{username}/{message.message_id}"
        else:
            chat_numeric = str(message.chat.id).removeprefix("-100")
            post_url = f"https://t.me/c/{chat_numeric}/{message.message_id}"

        post_record = TelegramPost(
            casting_id=casting_id,
            chat_id=message.chat.id,
            message_id=message.message_id,
            post_url=post_url,
            published_at=datetime.now(timezone.utc),
        )
        session.add(post_record)

        try:
            if commit:
                await session.commit()
                await session.refresh(post_record)
        except IntegrityError:
            await session.rollback()
            existing = await cls._existing_post(session, casting_id)
            if existing:
                # Another concurrent publish won — roll back our extra TG post to avoid duplicates.
                try:
                    await TelegramChannelService.delete_post(message.message_id)
                except Exception:  # pragma: no cover - rollback best-effort
                    logger.warning(
                        "TelegramSync.publish: failed to roll back duplicate TG post %s",
                        message.message_id,
                    )
                return existing
            raise

        return post_record

    @classmethod
    async def unpublish(
        cls,
        session: AsyncSession,
        casting_id: int,
        *,
        commit: bool = True,
    ) -> bool:
        """Delete the channel post (if any) and remove the DB record. Idempotent."""
        if not cls.is_configured():
            return False

        post = await cls._existing_post(session, casting_id)
        if not post:
            return False

        try:
            await TelegramChannelService.delete_post(message_id=post.message_id)
        except TelegramBadRequest as exc:
            # Common cases: "message to delete not found", "message can't be deleted"
            logger.warning(
                "TelegramSync.unpublish: TG delete soft-fail for casting %s, message %s: %s",
                casting_id,
                post.message_id,
                exc,
            )
        except TelegramAPIError as exc:
            logger.error(
                "TelegramSync.unpublish: TG delete failed for casting %s: %s",
                casting_id,
                exc,
                exc_info=True,
            )
            # Don't remove DB record — leave the post pinned in DB so admin can retry/clean up.
            return False

        await session.execute(
            delete(TelegramPost).where(TelegramPost.casting_id == casting_id)
        )
        if commit:
            await session.commit()
        return True

    @classmethod
    async def close(
        cls,
        session: AsyncSession,
        casting_id: int,
        *,
        commit: bool = True,
    ) -> bool:
        """Reply 'Кастинг завершён' under the existing post and stamp closed_at."""
        if not cls.is_configured():
            return False

        post = await cls._existing_post(session, casting_id)
        if not post:
            return False

        if post.closed_at is not None:
            # Already closed — no extra reply, just confirm idempotency.
            return True

        casting = await cls._load_casting(session, casting_id)
        if not casting:
            return False

        try:
            text = build_close_post_text(casting)
            channel = TelegramChannelService(post_text=_StaticText(text))
            await channel.reply_post(message_id=post.message_id)
        except TelegramBadRequest as exc:
            logger.warning(
                "TelegramSync.close: TG reply soft-fail for casting %s: %s",
                casting_id,
                exc,
            )
        except TelegramAPIError as exc:
            logger.error(
                "TelegramSync.close: TG reply failed for casting %s: %s",
                casting_id,
                exc,
                exc_info=True,
            )
            return False

        await session.execute(
            update(TelegramPost)
            .where(TelegramPost.casting_id == casting_id)
            .values(closed_at=datetime.now(timezone.utc))
        )
        if commit:
            await session.commit()
        return True

    @classmethod
    async def resync(
        cls,
        session: AsyncSession,
        casting_id: int,
        *,
        commit: bool = True,
    ) -> Optional[TelegramPost]:
        """Force a full refresh of the channel post: delete the old message and
        re-post from scratch. Use this when the post structure must change
        (text → photo, photo → text, image swapped). Idempotent and safe."""
        await cls.unpublish(session, casting_id, commit=commit)
        return await cls.publish(session, casting_id, commit=commit)

    @classmethod
    async def edit(
        cls,
        session: AsyncSession,
        casting_id: int,
        *,
        commit: bool = True,
    ) -> bool:
        """Update text/caption of an existing post if any. Best-effort.

        If the post structure no longer matches the casting (e.g. a text-only
        post now needs a photo, or vice-versa), Telegram rejects an in-place
        edit — we then transparently re-post via ``resync``."""
        if not cls.is_configured():
            return False

        post = await cls._existing_post(session, casting_id)
        if not post:
            return False

        casting = await cls._load_casting(session, casting_id)
        if not casting:
            return False

        has_image = bool(cls._resolve_image_url(casting))
        try:
            text = build_casting_post_text(casting, has_image=has_image)
            keyboard = CastingPostButton(casting=_CastingIdHolder(casting.id))
            channel = TelegramChannelService(post_text=_StaticText(text), button=keyboard)

            if has_image:
                await channel.edit_post_caption(message_id=post.message_id)
            else:
                await channel.edit_post_text(message_id=post.message_id)
        except TelegramBadRequest as exc:
            err = str(exc).lower()
            if "message is not modified" in err:
                return True
            # Structural mismatch between the live post and the desired post —
            # the safest fix is to delete & re-post with the correct media.
            structural = (
                "there is no caption" in err
                or "message can't be edited" in err
                or "message to edit not found" in err
                or "no text in the message" in err
                or "message can't be deleted" in err
            )
            if structural:
                logger.info(
                    "TelegramSync.edit: structural mismatch for casting %s (%s); re-posting",
                    casting_id,
                    exc,
                )
                reposted = await cls.resync(session, casting_id, commit=commit)
                return reposted is not None
            logger.warning(
                "TelegramSync.edit: TG edit soft-fail for casting %s: %s",
                casting_id,
                exc,
            )
            return False
        except TelegramAPIError as exc:
            logger.error(
                "TelegramSync.edit: TG edit failed for casting %s: %s",
                casting_id,
                exc,
                exc_info=True,
            )
            return False

        await session.execute(
            update(TelegramPost)
            .where(TelegramPost.casting_id == casting_id)
            .values(updated_at=datetime.now(timezone.utc))
        )
        if commit:
            await session.commit()
        return True
