"""
Rate Limiting — защита от парсинга (Scraping Protection).

Использует Redis для хранения счётчиков запросов.
Применяется как Dependency к эндпоинтам поиска.
"""
import time
from typing import Optional
from fastapi import HTTPException, Request, status
from config import settings
import redis.asyncio as aioredis


class RateLimiter:
    """
    Sliding window rate limiter на базе Redis.

    Args:
        requests_per_window: максимум запросов в окне
        window_seconds: длина окна в секундах
        key_prefix: префикс ключа в Redis
    """

    def __init__(
        self,
        requests_per_window: int = 30,
        window_seconds: int = 60,
        key_prefix: str = "rate_limit",
    ):
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
            )
        return self._redis

    def _get_client_key(self, request: Request) -> str:
        """Идентификатор клиента: IP + path."""
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        return f"{self.key_prefix}:{client_ip}:{path}"

    async def check(self, request: Request) -> None:
        """
        Проверяет лимит. Если превышен — бросает 429.
        """
        redis_client = await self._get_redis()
        key = self._get_client_key(request)
        now = time.time()
        window_start = now - self.window_seconds

        pipe = redis_client.pipeline()
        # Убираем устаревшие записи
        pipe.zremrangebyscore(key, 0, window_start)
        # Считаем текущие
        pipe.zcard(key)
        # Добавляем новый запрос
        pipe.zadd(key, {str(now): now})
        # TTL на ключ
        pipe.expire(key, self.window_seconds + 1)

        results = await pipe.execute()
        request_count = results[1]

        if request_count >= self.requests_per_window:
            retry_after = int(self.window_seconds - (now - window_start))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": "Rate limit exceeded. Try again later.",
                    "retry_after_seconds": max(retry_after, 1),
                },
                headers={"Retry-After": str(max(retry_after, 1))},
            )


# ─── Pre-configured limiters ───

# Для поисковых эндпоинтов (защита от скрейпинга)
search_rate_limiter = RateLimiter(
    requests_per_window=30,
    window_seconds=60,
    key_prefix="rl:search",
)

# Для auth эндпоинтов (защита от брутфорса)
auth_rate_limiter = RateLimiter(
    requests_per_window=10,
    window_seconds=60,
    key_prefix="rl:auth",
)

# Для OTP эндпоинтов
otp_rate_limiter = RateLimiter(
    requests_per_window=5,
    window_seconds=300,
    key_prefix="rl:otp",
)


async def rate_limit_dependency(request: Request) -> None:
    """FastAPI Dependency для rate limiting поисковых эндпоинтов."""
    await search_rate_limiter.check(request)


