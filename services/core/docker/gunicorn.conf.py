import multiprocessing
import os

name = "prostoprobuy_mvp_asgi"

bind = "0.0.0.0:8000"

loglevel = "warning"


def _cpu_count() -> int:
    try:
        return multiprocessing.cpu_count()
    except NotImplementedError:
        return 1


# В контейнерах (Railway/Docker) multiprocessing.cpu_count() часто возвращает
# число ядер ХОСТА, а не лимит контейнера. Это приводит к форку десятков
# воркеров и взрывному росту числа соединений к Postgres (workers * pool).
# Поэтому число воркеров берём из WEB_CONCURRENCY и жёстко ограничиваем.
# Для async (UvicornWorker) большое число воркеров не нужно — один event loop
# обрабатывает много конкурентных запросов.
_default_workers = min(_cpu_count() * 2 + 1, 6)
workers = int(os.getenv("WEB_CONCURRENCY", _default_workers) or _default_workers)
workers = max(2, workers)

worker_class = "uvicorn.workers.UvicornWorker"

max_requests = 1000
max_requests_jitter = 50

timeout = 30
graceful_timeout = 30

accesslog = "-"
errorlog = "-"

preload_app = True

reload = False