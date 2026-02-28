import multiprocessing

name = "prostoprobuy_mvp_asgi"

bind = "0.0.0.0:8000"

loglevel = "warning"

workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "uvicorn.workers.UvicornWorker"

threads = multiprocessing.cpu_count()

max_requests = 1000
max_requests_jitter = 50

timeout = 30
graceful_timeout = 30

accesslog = "-"
errorlog = "-"

preload_app = True

reload = False