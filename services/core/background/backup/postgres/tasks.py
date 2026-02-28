from background.celery_conf import celery_obj
import asyncio
from postgres.database_backup import backup_database

@celery_obj.task
def dump_db() -> None:
    asyncio.run(backup_database())