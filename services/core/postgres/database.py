from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy import NullPool, event, create_engine
import sys
from os.path import abspath, dirname
from functools import wraps
from config import settings, power_settings


sys.path.insert(0, dirname(dirname(dirname(abspath(__file__)))))


async_engine = create_async_engine(
    settings.DATABASE_URL,
    **power_settings.DB_CONN_PARAMS) # noqa

async_session_maker = sessionmaker(async_engine, class_=AsyncSession,  expire_on_commit=False) # noqa


def transaction(func):
    session_maker = async_session_maker
    @wraps(func) # noqa
    async def wrapper(*args, **kwargs):
        if 'session' not in kwargs:
            async with session_maker() as session:
                async with session.begin():
                    kwargs['session'] = session
                    return await func(*args, **kwargs)
        else:
            return await func(*args, **kwargs)
    return wrapper


class Base(DeclarativeBase):
    pass
