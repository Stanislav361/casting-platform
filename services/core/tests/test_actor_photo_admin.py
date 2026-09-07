"""Проверка правки фото анкеты супер-админом.

Здесь легко получить «всё работает, но ничего не работает». Панель показывает
три обязательных слота — портрет, профиль, полный рост — и заменяет фото
именно в нужном. Узнать, какое из фото портрет, она может только из поля
`photo_category` в ответе API. Этого поля в ответах не было: словарь медиа
собирался в семи местах руками, и категория не попала ни в один. Снаружи это
выглядело как «супер-админ не может редактировать фото актёров».

Поэтому проверяем то, на что опирается панель:
  1. в ответе есть категория фото и превью;
  2. загрузка требует указать ракурс — иначе фото молча становилось портретом
     и подменяло настоящий портрет актёра;
  3. фото правит только владелец платформы, не любой администратор.

Запуск (pytest не нужен):

    cd services/core && ./.venv/bin/python tests/test_actor_photo_admin.py
"""
from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, HTTPException  # noqa: E402

from actor_profiles.media_routes import MediaAssetAdminRouter  # noqa: E402
from actor_profiles.media_service import (  # noqa: E402
    ALLOWED_PHOTO_CATEGORIES,
    REQUIRED_PHOTO_CATEGORIES,
)
from shared.media import media_asset_payload  # noqa: E402

failures: list[str] = []


def check(title: str, condition: bool) -> None:
    print(f'{"ok  " if condition else "FAIL"}  {title}')
    if not condition:
        failures.append(title)


def openapi_schema() -> dict:
    app = FastAPI()
    app.include_router(MediaAssetAdminRouter().router, prefix='/admin')
    return app.openapi()


def main() -> int:
    # ── 1. Ответ API ────────────────────────────────────────────────────────
    asset = SimpleNamespace(
        id=7,
        file_type='photo',
        original_url='https://s3/orig.jpg',
        processed_url='https://s3/proc.jpg',
        thumbnail_url='https://s3/thumb.jpg',
        photo_category='full_height',
        is_primary=True,
        sort_order=2,
    )
    payload = media_asset_payload(asset)

    check(
        'в ответе есть ракурс фото — иначе панель не знает, что заменяет',
        payload['photo_category'] == 'full_height',
    )
    # Без превью панель тянула бы полноразмерные фото в сетку слотов.
    check('в ответе есть превью', payload['thumbnail_url'] == 'https://s3/thumb.jpg')
    check(
        'в ответе есть всё, из чего панель собирает плитку',
        set(payload) == {
            'id', 'file_type', 'original_url', 'processed_url',
            'thumbnail_url', 'photo_category', 'is_primary', 'sort_order',
        },
    )

    video = SimpleNamespace(
        id=8, file_type='video',
        original_url='https://s3/v.mp4', processed_url=None, thumbnail_url=None,
        photo_category=None, is_primary=False, sort_order=0,
    )
    check(
        'у видео ракурс пустой, а не выдуманный',
        media_asset_payload(video)['photo_category'] is None,
    )

    # ── 2. Ракурсы и загрузка ───────────────────────────────────────────────
    check(
        'обязательных ракурсов ровно три, как слотов в панели',
        set(REQUIRED_PHOTO_CATEGORIES) == {'portrait', 'profile', 'full_height'},
    )
    check(
        'дополнительные фото разрешены — панель предлагает их добавить',
        'additional' in ALLOWED_PHOTO_CATEGORIES,
    )

    schema = openapi_schema()
    paths = schema['paths']
    for method, path in (
        ('post', '/admin/actor-profiles/{profile_id}/media/photo/'),
        ('delete', '/admin/actor-profiles/{profile_id}/media/{asset_id}/'),
        ('patch', '/admin/actor-profiles/{profile_id}/media/{asset_id}/primary/'),
    ):
        check(f'есть ручка {method.upper()} {path}', method in paths.get(path, {}))

    upload_body = (
        paths['/admin/actor-profiles/{profile_id}/media/photo/']['post']
        ['requestBody']['content']['multipart/form-data']['schema']
    )
    body_name = upload_body['$ref'].rsplit('/', 1)[-1]
    upload_fields = schema['components']['schemas'][body_name]
    check(
        'загрузка требует указать ракурс явно',
        'photo_category' in upload_fields.get('required', []),
    )
    check(
        'у ракурса нет значения по умолчанию, которое подменит портрет',
        'default' not in upload_fields['properties']['photo_category'],
    )

    # ── 3. Доступ ───────────────────────────────────────────────────────────
    router = MediaAssetAdminRouter()

    def role_allowed(role: str) -> bool:
        try:
            router._check_superadmin(SimpleNamespace(role=role, id='1'))
            return True
        except HTTPException:
            return False

    check('владелец платформы правит фото', role_allowed('owner'))
    for role in ('administrator', 'manager', 'producer', 'employer_pro', 'employer', 'agent', 'user'):
        check(f'роль «{role}» чужие фото не правит', not role_allowed(role))

    print()
    if failures:
        print(f'Не прошло проверок: {len(failures)}')
        for title in failures:
            print(f'  — {title}')
        return 1
    print('Все проверки прошли.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
