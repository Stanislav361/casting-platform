"""Проверка приёмника отчётов о падениях браузера (POST /client-errors/).

Смысл ручки — не потерять ни один отчёт: она нужна ровно в тот момент, когда у
человека «не открывается приложение», и отказ из-за формата тела сделал бы её
бесполезной. Поэтому проверяем не только счастливый путь, но и битый JSON,
не-объект в теле, пустое тело и слишком длинный текст ошибки.

Запуск (pytest не нужен):

    cd services/core && ./.venv/bin/python tests/test_client_error_report.py
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from diagnostics.routes import MAX_MESSAGE_LEN, ClientErrorsRouter  # noqa: E402

app = FastAPI()
app.include_router(ClientErrorsRouter().router)
client = TestClient(app)

failures = 0


class _Capture(logging.Handler):
    """Собирает записи журнала, чтобы проверить, что отчёт вообще пишется."""

    def __init__(self):
        super().__init__(level=logging.WARNING)
        self.records: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.records.append(record.getMessage())


capture = _Capture()
logging.getLogger('diagnostics.routes').addHandler(capture)


def check(name: str, ok: bool, details: str = '') -> None:
    global failures
    if not ok:
        failures += 1
    print(f"{'OK  ' if ok else 'FAIL'} {name}" + (f" — {details}" if details and not ok else ''))


def post(**kwargs):
    capture.records.clear()
    response = client.post('/client-errors/', **kwargs)
    return response, ' '.join(capture.records)


def main() -> int:
    response, logged = post(json={
        'source': 'error-boundary',
        'message': 'ChunkLoadError: Loading chunk 4821 failed',
        'digest': '1234567890',
        'url': 'https://prostoprobuy.pro/actor-home',
        'build_id': 'abc123',
        'display_mode': 'standalone',
        'stale_bundle': True,
    })
    check('обычный отчёт принят', response.status_code == 204, f'код {response.status_code}')
    check('текст ошибки попал в лог', 'Loading chunk 4821 failed' in logged, logged)
    check('источник и признак старой сборки в логе',
          'source=error-boundary' in logged and 'stale_bundle=True' in logged, logged)
    check('адрес страницы в логе', 'actor-home' in logged, logged)

    response, logged = post(content='{ это не json'.encode(),
                            headers={'Content-Type': 'application/json'})
    check('битое тело не теряется', response.status_code == 204, f'код {response.status_code}')
    check('битое тело всё равно пишется в лог', 'это не json' in logged, logged)

    response, logged = post(json='просто строка')
    check('не-объект в теле принят', response.status_code == 204, f'код {response.status_code}')
    check('строка из тела попала в лог', 'просто строка' in logged, logged)

    response, logged = post(content=b'')
    check('пустое тело не роняет ручку', response.status_code == 204, f'код {response.status_code}')
    check('пустой отчёт помечен как unknown', 'unknown error' in logged, logged)

    response, logged = post(json={'message': 'x' * (MAX_MESSAGE_LEN * 3)})
    check('длинный стек обрезается', response.status_code == 204, f'код {response.status_code}')
    check('в лог ушло не больше лимита',
          logged.count('x') <= MAX_MESSAGE_LEN, f'символов: {logged.count("x")}')

    response, _ = post(content=b'{"message": "' + b'y' * (32 * 1024) + b'"}',
                       headers={'Content-Type': 'application/json'})
    check('огромное тело не пишем в журнал', response.status_code == 204, f'код {response.status_code}')

    print('\nВсе проверки пройдены.' if failures == 0 else f'\nПровалено проверок: {failures}')
    return 0 if failures == 0 else 1


if __name__ == '__main__':
    raise SystemExit(main())
