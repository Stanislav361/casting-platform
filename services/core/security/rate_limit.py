"""
Rate Limiting — защита от парсинга (Scraping Protection).

In-memory fallback когда Redis недоступен.
"""
import time
from typing import Optional, Dict
from collections import defaultdict
from fastapi import HTTPException, Request, status
from config import settings


class InMemoryRateLimiter:
    """Fallback rate limiter без Redis — хранит счётчики в памяти."""

    def __init__(self, requests_per_window: int = 30, window_seconds: int = 60, key_prefix: str = "rate_limit"):
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix
        self._store: Dict[str, list] = defaultdict(list)

    def _get_client_key(self, request: Request) -> str:
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        return f"{self.key_prefix}:{client_ip}:{path}"

    async def check(self, request: Request) -> None:
        key = self._get_client_key(request)
        now = time.time()
        window_start = now - self.window_seconds

        self._store[key] = [t for t in self._store[key] if t > window_start]

        if len(self._store[key]) >= self.requests_per_window:
            retry_after = int(self.window_seconds - (now - window_start))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"message": "Rate limit exceeded. Try again later.", "retry_after_seconds": max(retry_after, 1)},
                headers={"Retry-After": str(max(retry_after, 1))},
            )

        self._store[key].append(now)


class RedisRateLimiter:
    """Redis-based sliding window rate limiter."""

    def __init__(self, requests_per_window: int = 30, window_seconds: int = 60, key_prefix: str = "rate_limit"):
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix
        self._redis = None

    async def _get_redis(self):
        if self._redis is None:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._redis

    def _get_client_key(self, request: Request) -> str:
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        return f"{self.key_prefix}:{client_ip}:{path}"

    async def check(self, request: Request) -> None:
        redis_client = await self._get_redis()
        key = self._get_client_key(request)
        now = time.time()
        window_start = now - self.window_seconds

        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, self.window_seconds + 1)
        results = await pipe.execute()
        request_count = results[1]

        if request_count >= self.requests_per_window:
            retry_after = int(self.window_seconds - (now - window_start))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"message": "Rate limit exceeded. Try again later.", "retry_after_seconds": max(retry_after, 1)},
                headers={"Retry-After": str(max(retry_after, 1))},
            )


def _create_limiter(requests_per_window: int, window_seconds: int, key_prefix: str):
    """Создаёт Redis limiter если Redis доступен, иначе in-memory."""
    redis_url = getattr(settings, 'REDIS_URL', None)
    if redis_url and '://:@' not in str(redis_url) and redis_url != 'redis://:@localhost:6379':
        try:
            return RedisRateLimiter(requests_per_window, window_seconds, key_prefix)
        except Exception:
            pass
    return InMemoryRateLimiter(requests_per_window, window_seconds, key_prefix)


search_rate_limiter = _create_limiter(30, 60, "rl:search")
auth_rate_limiter = _create_limiter(10, 60, "rl:auth")
otp_rate_limiter = _create_limiter(5, 300, "rl:otp")


async def rate_limit_dependency(request: Request) -> None:
    """FastAPI Dependency для rate limiting поисковых эндпоинтов."""
    await search_rate_limiter.check(request)
