"""
Backup PostgreSQL database to Yandex Object Storage, that has S3 compatible
API.
"""
import datetime
import os
from pathlib import Path
from log.base import logger
import pytz
from config import settings
from os.path import abspath, dirname
from shared.services.s3.services.backups import S3BackupService
from botocore.exceptions import ClientError, BotoCoreError


DB_HOSTNAME = settings.POSTGRES_HOST
DB_NAME = settings.POSTGRES_DB
DB_USER = settings.POSTGRES_USER
BACKUP_KEY_PUB_FILE = f"{dirname(dirname(abspath(__file__)))}/environments/{'production' if settings.MODE == 'PROD' else 'development'}/postgres/backup_keys/backup_key.pem.pub"
TMP_DB_FILE = "/tmp/backup_db.sql.gz.enc"
TIME_ZONE = "Europe/Moscow"

def say_hello():
    logger.info(msg='start db dumping and encode it and sent to object storage')

def get_now_datetime_str():
    now = datetime.datetime.now(pytz.timezone(TIME_ZONE))
    return now.strftime('%Y-%m-%d__%H-%M-%S')


def check_key_file_exists():
    if not Path(BACKUP_KEY_PUB_FILE).is_file():
        logger.error(msg="Backup key file does not exist", extra={'filename': BACKUP_KEY_PUB_FILE})

def dump_database():
    logger.info(f"Dumping database to {TMP_DB_FILE}")
    dump_db_operation_status = os.WEXITSTATUS(os.system(
        f"PGPASSWORD={settings.POSTGRES_PASSWORD} pg_dump -h {DB_HOSTNAME} -U {DB_USER} {DB_NAME} | gzip -c --best | \
        openssl smime -encrypt -aes256 -binary -outform DEM \
        -out {TMP_DB_FILE} {BACKUP_KEY_PUB_FILE}"
    ))
    if dump_db_operation_status != 0:
        logger.error(msg="\U00002757 Failed to dump database", extra={'filename': dump_db_operation_status})
        exit(f"\U00002757 Dump database command exits with status "
             f"{dump_db_operation_status}.")
    logger.info(f"\U0001F510 DB dumped, archieved and encoded")


async def upload_dump_to_s3():
    try:
        logger.info("\U0001F4C2 Starting upload to Object Storage")
        with open(TMP_DB_FILE, "rb") as f:
            await S3BackupService().upload_file(
                file_name=f'db-{get_now_datetime_str()}.sql.gz.enc',
                file=f
            )
            logger.info("\U0001f680 Uploaded")

    except ClientError as err:
        logger.error(msg=str(err), extra={'filename': BACKUP_KEY_PUB_FILE})
        raise err

    except BotoCoreError as err:
        logger.error(msg=str(err), extra={'filename': BACKUP_KEY_PUB_FILE})
        raise err


def remove_temp_files():
    os.remove(TMP_DB_FILE)
    logger.info("\U0001F44D That's all!",)

async def backup_database():
    say_hello()
    check_key_file_exists()
    dump_database()
    await upload_dump_to_s3()
    remove_temp_files()

if __name__ == '__main__':
    print(BACKUP_KEY_PUB_FILE)