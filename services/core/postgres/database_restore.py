"""
Renew database on current server, if hostname startswith loader*
or ends with .local (can be modified in check_hostname function below).
Script download last dump from S3 (Yandex Object Storage), decrypt
and load it after clear current database state.
"""
import os
from pathlib import Path
import psycopg2
from config import settings
from os.path import abspath, dirname
from shared.services.s3.services.backups import S3BackupService
from botocore.exceptions import ClientError, BotoCoreError
from log.base import logger

DB_HOSTNAME = settings.POSTGRES_HOST
DB_NAME = settings.POSTGRES_DB
DB_USER = settings.POSTGRES_USER
DB_PASSWORD = settings.POSTGRES_PASSWORD
S3_BUCKET_NAME = settings.S3_BACKUP_ENDPOINT_URL
BACKUP_KEY_PRIVATE_FILE = f"{dirname(dirname(abspath(__file__)))}/environments/{'production' if settings.MODE == 'PROD' else 'development'}/postgres/backup_keys/backup_key.pem"

TMP_DB_FILENAME = '/tmp/backup_db.sql.gz.enc'

connection = psycopg2.connect(
    f"dbname={DB_NAME} user={DB_USER} host={DB_HOSTNAME} password={DB_PASSWORD}")
cursor = connection.cursor()


def say_hello():
    logger.info(f"\U00002757 Start download last database backup from object storage")

# def check_hostname():
#     hostname = socket.gethostname()
#     if not hostname.startswith('loader-') and not hostname.endswith('.local'):
#         exit(f"\U00002757 It seems this is not loader server "
#              f"({colored(hostname, 'red')}), exit.")
#     print(colored("We are on some loader or local server, ok\n", "green"))


def check_key_file_exists():
    if not Path(BACKUP_KEY_PRIVATE_FILE).is_file():
        logger.error(
            msg=f"\U00002757 Invalid Private key file not found",
            extra={'file_name': BACKUP_KEY_PRIVATE_FILE}
        )
        exit(
            f"""\U00002757 Private encrypt key ({BACKUP_KEY_PRIVATE_FILE}) "
            "not found. You can find help here: "
            "https://www.imagescape.com/blog/2015/12/18/encrypted-postgres-backups/"""
        )

async def download_s3_file():
    try:
        service = S3BackupService()
        last_backup_filename = await service.get_last_backup_filename()
        _silent_remove_file(last_backup_filename)
        file = await service.download_file(key=last_backup_filename)
        with open(TMP_DB_FILENAME, "wb") as f:
            f.write(file)
        logger.info(f"\U00002757 Downloaded backup from {last_backup_filename}")

    except ClientError as err:
        logger.error(msg=str(err))
        raise err

    except BotoCoreError as err:
        logger.error(msg=str(err))
        raise err

def unencrypt_database():
    operation_status = os.WEXITSTATUS(os.system(
        f"""openssl smime -decrypt -in {TMP_DB_FILENAME} -binary \
            -inform DEM -inkey {BACKUP_KEY_PRIVATE_FILE} \
            -out /tmp/db.sql.gz"""
    ))
    if operation_status != 0:
        logger.error(msg=f"\U00002757 Can not unecrypt db file, status ", )
        exit(f"\U00002757 Can not unecrypt db file, status "
             f"{operation_status}.")
    logger.info(msg=f"\U0001F511 Database unecnrypted")


def unzip_database():
    _silent_remove_file("/tmp/db.sql")
    operation_status = os.WEXITSTATUS(os.system(
        f"""gzip -d /tmp/db.sql.gz"""
    ))
    if operation_status != 0:
        logger.error(msg=f"\U00002757 Can not unecrypt db file, status ")
        exit(f"\U00002757 Can not unecrypt db file, status "
             f"{operation_status}.")
    logger.info(msg=f"\U0001F511 Database unzipped)")


def clear_database():
    tables = _get_all_db_tables()
    if not tables:
        return
    with connection:
        with connection.cursor() as local_cursor:
            local_cursor.execute("\n".join([
                f'drop table if exists "{table}" cascade;' # noqa
                for table in tables]))
    logger.info(f"\U00002757 Database cleared")


def load_database():
    logger.info(f"\U0001F4A4 Database load started")
    operation_status = os.WEXITSTATUS(os.system(
        f"""PGPASSWORD='{DB_PASSWORD}' psql -h {DB_HOSTNAME} -U {DB_USER} {DB_NAME} < /tmp/db.sql"""
    ))
    if operation_status != 0:
        logger.error(msg=f"\U00002757 Can not load db file, status ")
        exit(f"\U00002757 Can not load database, status {operation_status}.")
    logger.info(f"\U00002757 Database load finished")


def remove_temp_files():
    _silent_remove_file(TMP_DB_FILENAME)
    logger.info(f"\U00002757 Removed temporary files")


def _get_all_db_tables():
    cursor.execute("""SELECT table_name FROM information_schema.tables
                      WHERE table_schema = 'public' order by table_name;""")
    results = cursor.fetchall()
    tables = []
    for row in results:
        tables.append(row[0])
    return tables


def _silent_remove_file(filename: str):
    try:
        os.remove(filename)
    except FileNotFoundError:
        pass

async def restore_database():
    say_hello()
    check_key_file_exists()
    await download_s3_file()
    unencrypt_database()
    unzip_database()
    clear_database()
    load_database()
    remove_temp_files()

if __name__ == "__main__":
    import asyncio
    asyncio.run(restore_database())
