# import asyncio
# from src.exceptions import BaseAppException
# from functools import wraps
# from fastapi import Request, Response, status
# from fastapi.responses import HTMLResponse
# from src.config import settings
# from fastapi import FastAPI
# from src.dao.redis import RedisWebSocket, BaseRedisDAO
# from aioredis.exceptions import ConnectionError
# import json
# from fastapi.websockets import WebSocketState
# from loguru import logger
#
#
# def endpoint_config(req_timeout=10):
#     def decorator(func):
#         @wraps(func)
#         async def wrapper(*args, **kwargs):
#             try:
#                 return await asyncio.wait_for(func(*args, **kwargs), req_timeout)
#             except asyncio.TimeoutError:
#                 raise BaseAppException.request_timeout(req_timeout)
#             # except HTTPException as e:
#             #     raise e
#             # except Exception as e:
#             #     raise #ServerException.unknown_server_exc(e)
#         return wrapper
#     return decorator
