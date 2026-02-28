from fastapi import FastAPI
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
from log.base import logger
from config import settings
import traceback

class ErrorLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        try:
            response: Response = await call_next(request)
            if response.status_code >= 500:
                logger.error(
                    "Server error response",
                    extra={
                        "path": request.url.path,
                        "method": request.method,
                        "status_code": response.status_code,
                    },
                    exc_info=(settings.MODE != "PROD"),
                )
            return response

        except Exception as exc:
            if settings.MODE not in ["PROD", "LOCAL"]:
                # full traceback, JSON-friendly
                tb_list = traceback.format_exception(type(exc), exc, exc.__traceback__)
                logger.error(
                    "Unhandled exception during request",
                    extra={
                        "path": request.url.path,
                        "method": request.method,
                        "traceback": tb_list
                    },
                    exc_info=True,
                )
            elif settings.MODE == "PROD":
                tb_list = traceback.format_exception_only(type(exc), exc)
                logger.error(
                    "Unhandled exception during request",
                    extra={
                        "path": request.url.path,
                        "method": request.method,
                        "error_type": type(exc).__name__,
                        "error_message": str(exc),
                        "traceback": tb_list,  # short traceback
                    },
                    exc_info=False,
                )
            raise


def init_logs(app: FastAPI):
    app.add_middleware(ErrorLoggingMiddleware)