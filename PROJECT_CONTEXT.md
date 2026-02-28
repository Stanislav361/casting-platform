# Casting Platform v2.0 — Project Context

## Обзор проекта

**Название:** Casting Platform v2.0 (prostoprobuy)
**Архитектура:** Монорепозиторий — FastAPI (Python) + Next.js (React/TypeScript)
**БД:** PostgreSQL + Redis
**Стек:** Python 3.11, Node.js 22, pnpm 9, Docker

---

## Структура проекта

```
prostoprobuy-mvp-master/
├── services/core/               # Backend API (FastAPI)
│   ├── main/                    # Точки входа (local/dev/prod)
│   ├── migrations/              # Alembic миграции (42+ миграций)
│   ├── environments/            # .env файлы (local/dev/prod)
│   ├── users/                   # Пользователи, аутентификация, RBAC
│   ├── profiles/                # Legacy профили актёров
│   ├── actor_profiles/          # Multi-profile система (V2)
│   ├── castings/                # Кастинги/проекты
│   ├── reports/                 # Отчёты и шорт-листы
│   ├── shortlists/              # SSOT шорт-листы
│   ├── employer/                # Функционал работодателя
│   ├── billing/                 # Биллинг и подписки
│   ├── oauth/                   # Мультипровайдерная OAuth авторизация
│   ├── crm/                     # CRM: уведомления, Trust Score, блэклист, чат
│   ├── rbac/                    # Role-Based Access Control
│   ├── security/                # HTTP Security Headers + Rate Limiting
│   ├── cities/                  # Справочник городов
│   ├── postgres/                # Подключение к БД
│   ├── shared/                  # Общие утилиты (S3, Telegram, Google)
│   └── log/                     # Логирование
│
├── frontend/
│   ├── apps/admin/              # Админ-панель (Next.js 15, порт 3001)
│   ├── apps/tma/                # Основное приложение (Next.js 15, порт 3002)
│   └── packages/                # Общие пакеты (models, hooks, links, toolkit)
│
├── docker-compose.*.yml         # Docker конфигурации
├── Makefile                     # Команды сборки/деплоя
└── PROJECT_CONTEXT.md           # Этот файл
```

---

## Роли пользователей

| Роль | Код в БД | Описание |
|------|----------|----------|
| **SuperAdmin** | `owner` | Полный доступ. Удаление любых профилей/проектов |
| **Администратор** | `administrator` | Управление пользователями, кастингами, отчётами |
| **Менеджер** | `manager` | Управление кастингами и актёрами, SOFT_DELETE |
| **Продюсер** | `producer` | Просмотр отчётов и шорт-листов |
| **Админ PRO** | `employer_pro` | Подписка PRO: все актёры + шорт-листы из любых |
| **Админ** | `employer` | Подписка Basic: свои кастинги + только откликнувшиеся |
| **Актёр** | `user` | Свой профиль + лента + отклики на кастинги |

---

## Подписки

| План | Код | Цена | Возможности |
|------|-----|------|-------------|
| **Админ (Basic)** | `basic` | 990₽/мес | Кастинги, работа с откликнувшимися |
| **Админ PRO** | `pro` | 2990₽/мес | Все актёры, полнотекстовый поиск, шорт-листы |

Grace Period: 24 часа после истечения подписки.

---

## База данных — 24 таблицы

### Пользователи и авторизация
- `users` — пользователи (роли, email, telegram, soft delete)
- `user_oauth_providers` — связи OAuth (Telegram, VK, Email)
- `auth_predicates` — предикаты авторизации (dev mode)
- `otp_codes` — OTP коды верификации

### Профили актёров
- `profiles` — legacy-профили (backward compatibility)
- `profile_images` — фото профилей с координатами кропа
- `actor_profiles` — мульти-профили V2 (один user → N профилей)
- `media_assets` — медиа-файлы (фото/видео) с метаданными

### Кастинги и отклики
- `castings` — проекты/кастинги (owner_id, статус)
- `casting_images` — изображения кастингов
- `casting_posts` — посты в Telegram-канале
- `profile_responses` — отклики актёров на кастинги

### Отчёты и шорт-листы
- `reports` — отчёты (привязка к кастингу, public_id)
- `profiles_reports` — связь профиль ↔ отчёт (избранное)
- `shortlist_tokens` — SSOT-токены для публичного доступа

### Биллинг
- `billing_plans` — тарифные планы (Basic/Pro)
- `user_subscriptions` — подписки с Grace Period
- `subscriptions` — legacy-подписки

### CRM
- `notifications` — уведомления (in_app/email/telegram)
- `trust_score_logs` — лог расчёта Trust Score
- `blacklist` — блокировки (temporary/permanent + reason)
- `action_logs` — микро-чат + Action Log (комментарии, теги)

### Справочники
- `cities` — города

---

## API — 114 эндпоинтов

### Авторизация
- `POST /auth/v2/register/` — регистрация Email/Password
- `POST /auth/v2/login/` — логин
- `POST /auth/v2/otp/send/` — отправка OTP
- `POST /auth/v2/otp/verify/` — верификация OTP
- `POST /auth/v2/refresh/` — обновление токена
- `POST /auth/v2/switch-profile/` — переключение профиля

### OAuth
- `POST /auth/oauth/{provider}/url/` — получить URL (Telegram/VK)
- `POST /auth/oauth/{provider}/callback/` — OAuth callback
- `POST /auth/oauth/telegram/verify/` — прямая верификация Telegram
- `GET /auth/oauth/providers/` — список привязанных провайдеров

### Профили актёров (Multi-profile)
- `POST /tma/actor-profiles/` — создать профиль
- `GET /tma/actor-profiles/my/` — мои профили (Switch Profile)
- `GET /tma/actor-profiles/{id}/` — детали профиля
- `PATCH /tma/actor-profiles/{id}/` — обновить профиль
- `POST /tma/actor-profiles/{id}/media/photo/` — загрузить фото
- `POST /tma/actor-profiles/{id}/media/video/` — загрузить видео

### Работодатель (Employer)
- `POST /employer/projects/` — создать проект
- `GET /employer/projects/` — мои проекты
- `PATCH /employer/projects/{id}/` — обновить проект
- `DELETE /employer/projects/{id}/` — удалить проект
- `GET /employer/projects/{id}/respondents/` — откликнувшиеся актёры
- `GET /employer/actors/all/` — все актёры (только PRO)
- `POST /employer/reports/create/` — создать шорт-лист
- `POST /employer/reports/{id}/add-actors/` — добавить актёров в шорт-лист

### Лента актёра
- `GET /feed/projects/` — лента опубликованных проектов
- `POST /feed/respond/` — откликнуться на проект
- `GET /feed/my-responses/` — история откликов

### Биллинг
- `GET /billing/plans/` — тарифные планы
- `POST /billing/subscribe/` — оформить подписку
- `GET /billing/my/` — моя подписка
- `POST /billing/cron/check-expired/` — деактивация истёкших

### Поиск
- `GET /search/project/{id}/` — Basic: поиск среди откликнувшихся
- `GET /search/global/` — Pro: полнотекстовый поиск по базе
- `GET /search/actor/{id}/` — публичный профиль (Data Isolation)

### CRM
- `GET /notifications/` — мои уведомления
- `POST /notifications/read/` — отметить прочитанным
- `GET /trust-score/{id}/` — Trust Score профиля
- `POST /trust-score/{id}/event/` — добавить событие
- `GET /blacklist/` — список заблокированных
- `POST /blacklist/ban/` — заблокировать
- `POST /blacklist/unban/` — разблокировать
- `POST /collaboration/casting/{id}/comment/` — комментарий в чат
- `GET /collaboration/casting/{id}/log/` — лог обсуждения

### SuperAdmin
- `GET /superadmin/stats/` — статистика платформы
- `GET /superadmin/users/` — все пользователи
- `DELETE /superadmin/profiles/{id}/` — удалить любой профиль
- `DELETE /superadmin/castings/{id}/` — удалить любой кастинг

### SSOT (публичный доступ)
- `GET /public/shortlists/view/{token}/` — просмотр шорт-листа по токену

---

## Frontend — страницы

### TMA App (порт 3002)
| URL | Описание |
|-----|----------|
| `/login` | Выбор способа входа (Telegram/VK/Email) |
| `/login/email` | Вход/регистрация через Email |
| `/login/role` | Выбор роли (Актёр/Админ/АдминПро/SuperAdmin) |
| `/login/callback` | OAuth callback |
| `/cabinet` | Кабинет актёра (создание/управление анкетами) |
| `/cabinet/profile/{id}` | Детали профиля актёра |
| `/cabinet/profile/{id}/edit` | Редактирование профиля |
| `/cabinet/profile/{id}/media` | Загрузка фото/видео |
| `/cabinet/profile/create` | Создание нового профиля |
| `/dashboard` | Панель работодателя (проекты, подписка) |
| `/dashboard/project/{id}` | Детали проекта (редактирование, отклики, чат) |
| `/dashboard/admin` | SuperAdmin панель (статистика, пользователи, blacklist) |

### Admin App (порт 3001)
| URL | Описание |
|-----|----------|
| `/` | Страница входа (Telegram/DEV авторизация) |
| `/actors` | Управление актёрами |
| `/castings` | Управление кастингами |
| `/reports` | Отчёты и шорт-листы |
| `/users` | Управление пользователями |

---

## Технологический стек

### Backend
- **FastAPI** 0.115 + **Uvicorn** + **Gunicorn**
- **SQLAlchemy** 2.0 (async) + **Alembic**
- **PostgreSQL** 16 + **asyncpg**
- **Redis** 5+ (кеширование, Rate Limiting)
- **Celery** 5.5 (фоновые задачи)
- **JWT** (python-jose) + **OAuth2** (Telegram, VK)
- **Pillow** (ресайз фото) + **FFmpeg** (транскодирование видео)
- **boto3/aiobotocore** (S3 хранилище)
- **Pydantic** 2.11 (валидация)
- **OpenTelemetry** (трейсинг)

### Frontend
- **Next.js** 15.3 + **React** 19 + **TypeScript** 5.8
- **pnpm** workspace (монорепо) + **Turbo** 2.5
- **TanStack Query** 5 (серверное состояние)
- **Effector** 23 (клиентское состояние)
- **Axios** (HTTP клиент)
- **SCSS** modules (стилизация)
- **Telegram Mini App SDK** (TMA интеграция)

### Инфраструктура
- **Docker** + **Docker Compose** (base/dev/prod)
- **Nginx** (reverse proxy)
- **Prometheus** + **Grafana** (мониторинг)
- **Loki** + **Promtail** (логи)
- **Tempo** (трейсинг)

---

## Security

- **L7 Security Headers**: CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, HSTS
- **Rate Limiting**: Redis sliding window на эндпоинты поиска и авторизации
- **RBAC**: 7 ролей, Permission Matrix, Middleware аудита
- **JWT**: Access Token (60 мин) + Refresh Token (30 дней, HTTP-only cookie)
- **Data Isolation**: internal_notes, admin_rating скрыты от внешних пользователей
- **Soft Delete**: мягкое удаление с is_deleted + deleted_at
- **Blacklist**: временные/перманентные блокировки с reason_log

---

## Реализованные пункты ТЗ

### Season 01: Архитектурное ядро + Security ✅
- [x] 1.1 SSOT — динамические шорт-листы через токены
- [x] 1.2 RBAC — иерархия ролей, HARD/SOFT DELETE
- [x] 1.3 L7 Security — заголовки, Rate Limiting

### Season 02: Кабинет Актёра 2.0 ✅
- [x] 2.1 Multi-profile — One-to-Many, Switch Profile
- [x] 2.2 Auth Service — JWT, Email/Password, OTP, OAuth
- [x] 2.3 Media Assets — S3, Pillow, FFmpeg

### Season 03: Коммерческий модуль ✅
- [x] 3.1 Тарификация — Basic (990₽) / Pro (2990₽)
- [x] 3.2 Биллинг — подписки, cron, Grace Period 24h
- [x] 3.3 Data Isolation — виртуализация полей

### Season 04: Smart CRM ✅
- [x] 4.1 Workflow — Event-driven уведомления
- [x] 4.2 Trust Score — алгоритм расчёта
- [x] 4.3 Blacklist Engine — Temporary/Permanent + Reason
- [x] 4.4 Collaboration — микро-чат, Action_Log, тегирование

### Дополнительно реализовано:
- [x] Мультипровайдерная OAuth (Telegram + VK + Email)
- [x] Отвязка от Telegram — работает в любом браузере
- [x] 4 роли пользователей (SuperAdmin, АдминПро, Админ, Актёр)
- [x] 2 подписки (Basic, Pro)
- [x] SuperAdmin панель
- [x] Живой чат админов (виджет)
- [x] Страница выбора роли после регистрации
- [x] Dashboard работодателя с CRUD проектов
