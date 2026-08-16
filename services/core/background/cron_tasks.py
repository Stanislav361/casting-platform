"""
Background cron-like tasks for Season 03/04.

- Billing subscription status checks (grace/expired transitions)
- Blacklist temporary ban expiration checks
- Дозвон в Telegram-канал: сообщения о завершении кастингов, которые не ушли
"""
import asyncio
from typing import Optional


CRON_INTERVAL_SECONDS = 300  # 5 minutes
_cron_task: Optional[asyncio.Task] = None


async def _retry_channel_close_notices() -> None:
    """Дослать в канал сообщения «Кастинг завершён», которые не ушли сразу.

    Отправка при завершении кастинга не может блокировать саму операцию,
    поэтому при недоступном Telegram сообщение теряется. Человек не должен
    потом вспоминать про кнопку «Сообщить в канал» — досылаем сами.
    """
    from castings.services.shared.telegram_sync import CastingTelegramSyncService
    from postgres.database import async_session_maker

    async with async_session_maker() as session:
        await CastingTelegramSyncService.retry_pending_close_notices(session)


async def _run_loop() -> None:
    while True:
        try:
            # Lazy imports avoid heavy import-time coupling.
            from billing.service import BillingService
            from crm.service import BlacklistService

            await BillingService.check_and_deactivate_expired()
            await BlacklistService.check_expired_bans()
        except Exception:
            # Keep loop alive even if one iteration fails.
            pass

        # Отдельным блоком: сбой рассылки в канал не должен мешать биллингу и
        # наоборот — иначе одна ошибка «съедала» бы весь проход цикла.
        try:
            await _retry_channel_close_notices()
        except Exception:
            pass

        await asyncio.sleep(CRON_INTERVAL_SECONDS)


def start_cron_tasks() -> None:
    global _cron_task
    if _cron_task and not _cron_task.done():
        return
    _cron_task = asyncio.create_task(_run_loop())


async def stop_cron_tasks() -> None:
    global _cron_task
    if not _cron_task:
        return
    _cron_task.cancel()
    try:
        await _cron_task
    except asyncio.CancelledError:
        pass
    _cron_task = None
