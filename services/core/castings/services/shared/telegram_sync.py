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

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from castings.enums import CastingStatusEnum
from castings.models import Casting, TelegramPost
from castings.services.admin.telegram.channel.templates.types.buttons import (
    CastingPostButton,
    public_web_base_url,
)
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

        🏙 <b>Город: Норильск</b>
        🎬 <b>Сериал • АМС</b>
        👤 <b>Девочка • 11-14 лет</b>
        📅 <b>24.06.2026.</b>
        💰 <b>3400₽/смена.</b>

        Описание (truncated to fit Telegram limit)
    """

    title = _escape_html(getattr(casting, "title", "")).strip()
    description_raw = getattr(casting, "description", "") or ""

    meta_lines: list[str] = []

    # 1. City (First)
    city = _escape_html(getattr(casting, "city", None)).strip()
    if city:
        meta_lines.append(f"🏙 <b>Город: {city}</b>")

    # 2. Project Category and Roles (Second)
    category = _escape_html(getattr(casting, "project_category", None)).strip()
    roles = _escape_html(_format_role_types(casting))
    if category and roles:
        meta_lines.append(f"🎬 <b>{category} • {roles}</b>")
    elif category:
        meta_lines.append(f"🎬 <b>{category}</b>")
    elif roles:
        meta_lines.append(f"🎬 <b>{roles}</b>")

    # 3. Gender and Age (Third)
    gender = _escape_html(getattr(casting, "gender", None)).strip()
    age = _format_age(casting)
    if gender and age:
        meta_lines.append(f"👤 <b>{gender} • {age}</b>")
    elif gender:
        meta_lines.append(f"👤 <b>{gender}</b>")
    elif age:
        meta_lines.append(f"👤 <b>{age}</b>")

    # 4. Dates (Fourth)
    dates_raw = getattr(casting, "shooting_dates", None) or ""
    dates = _escape_html(_clean_dates(dates_raw))
    if dates:
        if not dates.endswith("."):
            dates = f"{dates}."
        meta_lines.append(f"📅 <b>{dates}</b>")

    # 5. Fee (Fifth)
    finance_raw = getattr(casting, "financial_conditions", None) or ""
    finance = _escape_html(_format_finance(finance_raw))
    if finance:
        if not finance.endswith("."):
            finance = f"{finance}."
        meta_lines.append(f"💰 <b>{finance}</b>")

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
    # Пост ушёл, но не в идеальном виде (например, без загруженной обложки).
    last_warning: Optional[str] = None

    @staticmethod
    def is_configured() -> bool:
        channel = getattr(settings, "TG_CHANEL_NAME", "") or ""
        token = getattr(settings, "TG_BOT_TOKEN", "") or ""
        return bool(channel.strip()) and bool(token.strip())

    @classmethod
    async def diagnose(cls, session: AsyncSession) -> dict:
        """Собрать полную картину состояния интеграции с каналом.

        Публикация в канал намеренно best-effort: любая ошибка только пишется в
        лог, чтобы не ломать публикацию кастинга. Обратная сторона — сбой
        невидим. Этот метод отвечает на вопрос «почему пост не ушёл»: задан ли
        канал, видит ли его бот, есть ли право постить и какая ссылка уйдёт в
        кнопку «Откликнуться».
        """
        from castings.services.admin.telegram.channel.templates.types.buttons import (
            build_casting_deeplink,
        )
        from shared.services.telegram.bot.client import bot

        channel = (getattr(settings, "TG_CHANEL_NAME", "") or "").strip()
        token = (getattr(settings, "TG_BOT_TOKEN", "") or "").strip()

        report: dict[str, Any] = {
            "configured": cls.is_configured(),
            "channel": channel or None,
            "bot_token_set": bool(token),
            "public_web_url": (getattr(settings, "PUBLIC_WEB_URL", "") or "").strip() or None,
            "sample_button_url": build_casting_deeplink(0),
            "problems": [],
        }

        if not channel:
            report["problems"].append(
                "TG_CHANEL_NAME не задан — публикация в канал полностью отключена "
                "(кастинг публикуется в приложении, пост не отправляется)."
            )
        if not token:
            report["problems"].append("TG_BOT_TOKEN не задан — бот не может отправлять сообщения.")

        if channel and token:
            try:
                async with bot as session_bot:
                    me = await session_bot.get_me()
                    report["bot"] = {"id": me.id, "username": me.username}

                    chat = await session_bot.get_chat(channel)
                    report["chat"] = {
                        "id": chat.id,
                        "title": chat.title,
                        "username": chat.username,
                        "type": str(getattr(chat, "type", "")),
                    }

                    member = await session_bot.get_chat_member(chat.id, me.id)
                    status = str(getattr(member, "status", ""))
                    can_post = getattr(member, "can_post_messages", None)
                    report["bot_rights"] = {
                        "status": status,
                        "can_post_messages": can_post,
                        "can_edit_messages": getattr(member, "can_edit_messages", None),
                        "can_delete_messages": getattr(member, "can_delete_messages", None),
                    }
                    if "administrator" not in status:
                        report["problems"].append(
                            f"Бот @{me.username} не администратор канала (статус: {status}). "
                            "Добавьте его в администраторы канала с правом публикации."
                        )
                    elif can_post is False:
                        report["problems"].append(
                            f"У бота @{me.username} нет права «Публикация сообщений» в канале."
                        )
            except Exception as exc:  # noqa: BLE001 - диагностика не должна падать
                report["problems"].append(
                    f"Бот не может обратиться к каналу «{channel}»: {exc}. "
                    "Проверьте, что имя канала верное и бот добавлен в администраторы."
                )

        try:
            total = await session.scalar(select(func.count()).select_from(TelegramPost))
            report["posts_total"] = int(total or 0)
            last = await session.execute(
                select(TelegramPost).order_by(TelegramPost.published_at.desc()).limit(1)
            )
            last_post = last.scalar_one_or_none()
            if last_post:
                report["last_post"] = {
                    "casting_id": last_post.casting_id,
                    "post_url": last_post.post_url,
                    "published_at": (
                        last_post.published_at.isoformat() if last_post.published_at else None
                    ),
                }
            else:
                report["last_post"] = None
                report["problems"].append(
                    "В базе нет ни одного отправленного поста — приложение ещё ни разу "
                    "успешно не публиковало кастинг в канал."
                )
        except Exception as exc:  # noqa: BLE001
            report["posts_total"] = None
            report["problems"].append(f"Не удалось прочитать историю постов: {exc}")

        report["cover_check"] = await cls._diagnose_cover(session)
        if report["cover_check"].get("problem"):
            report["problems"].append(report["cover_check"]["problem"])

        report["ok"] = not report["problems"]
        return report

    @classmethod
    async def _diagnose_cover(cls, session: AsyncSession) -> dict:
        """Проверить, что обложку свежего кастинга реально можно отправить.

        Картинку в Telegram грузим байтами: сервер сам скачивает файл и
        отдаёт его боту. Если файл недоступен (истёкшая ссылка S3, закрытый
        бакет), пост с загруженной обложкой не отправляется вовсе — поэтому
        проверяем это заранее, не публикуя ничего в канал.
        """
        result: dict[str, Any] = {}
        try:
            latest = await session.execute(
                select(Casting)
                .options(selectinload(Casting.image))
                .where(Casting.status == CastingStatusEnum.published)
                .order_by(Casting.id.desc())
                .limit(1)
            )
            casting = latest.unique().scalar_one_or_none()
            if not casting:
                result["checked_casting_id"] = None
                return result

            result["checked_casting_id"] = casting.id
            real_url = cls._real_cover_url(casting)
            url = real_url or cls._fallback_cover_url(casting)
            result["kind"] = "загруженная обложка" if real_url else "стандартная обложка"
            result["url"] = url

            import httpx

            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                size = len(resp.content or b"")
            result["size_bytes"] = size
            if size <= 0:
                result["problem"] = (
                    f"Обложка кастинга #{casting.id} скачивается пустой ({url}) — "
                    "пост с картинкой не отправится."
                )
            else:
                result["ok"] = True
        except Exception as exc:  # noqa: BLE001
            result["problem"] = (
                f"Сервер не может скачать обложку кастинга "
                f"#{result.get('checked_casting_id')}: {exc}. "
                "Кастинг с загруженной картинкой не уйдёт в канал."
            )
        return result

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
    def _force_https_media_url(url: Optional[str]) -> Optional[str]:
        if not url or not url.startswith("http://"):
            return url
        host = url[len("http://"):].split("/", 1)[0].split(":", 1)[0]
        if host in ("localhost", "127.0.0.1") or host.startswith("192.168.") or host.startswith("10."):
            return url
        return "https://" + url[len("http://"):]

    @staticmethod
    def _real_cover_url(casting: Casting) -> Optional[str]:
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
            return CastingTelegramSyncService._force_https_media_url(real_url)
        return None

    @staticmethod
    def _fallback_cover_url(casting: Casting) -> Optional[str]:
        """Return the same deterministic fallback cover as the PWA.

        Frontend logic lives in `shared/fallback-cover.ts`:
        `getCoverImage(imageUrl, casting.id || casting.title)` → if no real
        image, use `/fallback-covers/{01..12}.png` based on a JS 32-bit rolling
        hash. Telegram must use the same cover so channel posts visually match
        the casting page even when no custom image was uploaded.
        """
        base_url = public_web_base_url()

        seed = str(getattr(casting, "id", None) or getattr(casting, "title", "") or "fallback-cover")
        h = 0
        for char in seed:
            h = ((h * 31) + ord(char)) & 0xFFFFFFFF
        index = (h % 12) + 1
        return f"{base_url}/fallback-covers/{index:02d}.png"

    @classmethod
    def _resolve_image_url(cls, casting: Casting) -> Optional[str]:
        """Pick the image shown by the PWA: real cover first, fallback second."""
        real_url = cls._real_cover_url(casting)
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
        cls.last_warning = None
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

        real_image_url = cls._real_cover_url(casting)
        fallback_image_url = cls._fallback_cover_url(casting)
        keyboard = CastingPostButton(casting=_CastingIdHolder(casting.id))

        # Пост в канал должен уйти ВСЕГДА. Раньше сбой отправки загруженной
        # обложки означал, что кастинг молча не попадал в канал вовсе — это
        # хуже, чем пост со стандартной обложкой или без картинки. Поэтому
        # пробуем по очереди: загруженная обложка → стандартная → просто текст.
        attempts: list[tuple[str, Optional[str]]] = []
        if real_image_url:
            attempts.append(("uploaded", real_image_url))
        if fallback_image_url and fallback_image_url != real_image_url:
            attempts.append(("fallback", fallback_image_url))
        attempts.append(("text", None))

        message = None
        used_kind: Optional[str] = None
        for kind, url in attempts:
            try:
                text = build_casting_post_text(casting, has_image=bool(url))
                channel = TelegramChannelService(post_text=_StaticText(text), button=keyboard)
                if url:
                    message = await channel.send_post_with_image(image_url=url)
                else:
                    message = await channel.send_post_without_image()
                used_kind = kind
                break
            except Exception as exc:  # TelegramAPIError / network / value errors
                cls.last_error = exc
                logger.error(
                    "TelegramSync.publish: attempt '%s' failed for casting %s: %s",
                    kind,
                    casting_id,
                    exc,
                    exc_info=True,
                )

        if message is None:
            logger.error(
                "TelegramSync.publish: every send attempt failed for casting %s", casting_id
            )
            return None

        if real_image_url and used_kind != "uploaded":
            # Пост в канале есть, но не с той картинкой, которую загрузил админ.
            # Callers сообщают об этом супер-админам, чтобы обложку переотправили.
            cls.last_warning = (
                f"пост опубликован без загруженной обложки (причина: {cls.last_error})"
            )
        else:
            cls.last_warning = None

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

        casting = await cls._load_casting(session, casting_id)
        if not casting:
            return False

        post = await cls._existing_post(session, casting_id)
        if not post:
            # Опубликованный кастинг без поста — след прошлого сбоя отправки.
            # Любое редактирование должно это вылечить, а не молча проходить мимо.
            if casting.status == CastingStatusEnum.published:
                published = await cls.publish(session, casting_id, commit=commit)
                return published is not None
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
