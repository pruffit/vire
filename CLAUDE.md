# Vire — инструкция для Claude Code

Независимая музыкальная площадка для артистов и слушателей СНГ.
Полная документация: `docs/concept.md`, `docs/architecture.md`, `docs/data-schema.md`.

## Стек

- **Монорепо:** Turborepo + pnpm workspaces
- **Фронт + API:** Next.js 15 (App Router), TypeScript strict
- **UI:** Radix Primitives / shadcn (headless) + Tailwind — кастомные токены, не дефолтный shadcn
- **База:** PostgreSQL + Drizzle ORM (`packages/db`)
- **Очередь:** Redis + BullMQ
- **Хранилище:** S3 (Selectel на проде, MinIO локально)
- **Транскодинг:** ffmpeg-воркер (`apps/worker`), HLS-нарезка
- **Аутентификация:** Auth.js (NextAuth)
- **Деплой:** Selectel VPS + Docker

## Структура монорепо

```
apps/
  web/        — Next.js: фронт + API (Route Handlers /api/v1/*)
  worker/     — BullMQ воркеры: транскодинг, рассылки
packages/
  core/       — бизнес-логика, use-cases (чистый TS, НЕ зависит от Next)
  db/         — Drizzle схема + миграции + клиент (@vire/db)
  api-contracts/ — zod-схемы запросов/ответов, общие типы
  api-client/ — типизированный fetch-клиент
  ui/         — общий UI-кит (Radix + кастомный Tailwind)
  media/      — утилиты HLS, waveform
  config/     — tsconfig, eslint, tailwind preset
docs/         — концепция, архитектура, схема данных
```

## Архитектурные правила (обязательно соблюдать)

### Слои — строго сверху вниз

```
Route Handler (apps/web/app/api)     — только HTTP: валидация входа, вызов сервиса, ответ
        ↓
Service / Use-case (packages/core)   — вся бизнес-логика
        ↓
Repository (packages/db)             — запросы к БД
        ↓
PostgreSQL
```

- Хендлер не знает про БД
- Сервис не знает про HTTP
- Репозиторий не знает про бизнес-правила
- `packages/core` не импортирует ничего из Next.js

### FSD на фронтенде

```
app/ → pages/ → widgets/ → features/ → entities/ → shared/
```

Импорт только вниз по слоям. Публичный API слайса — только через `index.ts`.

### Чистота кода

- Бизнес-правила — чистые функции (одинаковый вход → одинаковый выход)
- Все эффекты (БД, S3, время, случайность) — за интерфейсами, инъектируются
- Время: не `new Date()` в логике, а инъектируемый `Clock`
- Ошибки как значения (`Result<T, E>`), не исключения сквозь слои
- Любой внешний вход валидируется через zod до попадания в логику

### TypeScript

- `strict: true` везде
- Никаких `any` без явной причины и комментария
- Типы выводятся из zod-схем — один источник правды

## База данных

Схема в `packages/db/src/schema/`. 16 таблиц, ключевые решения:

- `track_contributors` с `payout_share numeric(5,2)` — не `artist_id` в треке напрямую
- `rights_holders` отдельно от `artist_profiles` (бренд ≠ получатель денег)
- Файлы в S3 по `/vault/tracks/{track_id}/source.flac` — не по артисту
- `play_events` — аналитический лог, пишется через буфер, не прямым инсертом
- `theme_tokens` JSONB в профиле артиста — темизация на уровне данных
- `subscriptions.type` полиморфный: `ARTIST_TIER` | `LISTENER_PREMIUM`

Команды:
```bash
pnpm --filter @vire/db db:generate   # сгенерировать миграцию
pnpm --filter @vire/db db:migrate    # применить миграции
pnpm --filter @vire/db db:studio     # открыть Drizzle Studio
```

## Медиа и аудио

- Артист заливает FLAC → воркер режет в HLS (`.m3u8` + чанки) → `apps/worker`
- Стриминг в плеере только через HLS (`hls.js`), никаких прямых ссылок на mp3/flac
- FLAC отдаётся только по Signed URL после покупки
- Waveform — предрассчитанные пики в `track_audio.waveform_peaks` (JSONB), без Web Audio API

## Темизация

Три слоя:
1. **Оболочка платформы** — нейтральная, свои токены
2. **Страница артиста** — `artist_profiles.theme_tokens` из БД инжектируется как CSS-переменные в корневой div
3. **Плеер** — нейтральный, подхватывает акцентный цвет текущего релиза

Компоненты пишутся на `bg-[var(--artist-bg)]`, `text-[var(--artist-text)]` — без форков кода.

## Локальная разработка

```bash
# инфраструктура (postgres + redis + minio)
docker compose up -d

# все пакеты
pnpm install

# дев-режим
pnpm dev

# только web
pnpm --filter @vire/web dev
```

Переменные окружения: скопируй `.env.example` в `.env` и заполни.
DATABASE_URL для локалки: `postgresql://vire:vire@localhost:5432/vire`

## Текущий статус

- [x] Монорепо скелет (Turborepo + pnpm)
- [x] Документация (`docs/`)
- [x] Локальная инфраструктура (docker-compose)
- [x] Монорепо скелет (Turborepo + pnpm)
- [x] Документация (`docs/`)
- [x] Локальная инфраструктура (docker-compose)
- [x] `packages/db` — Drizzle схема, 16 таблиц, миграция применена
- [x] `packages/config` — tsconfig/base, nextjs, library + eslint/base
- [x] `apps/web` — Next.js, подключён @vire/db, Route Handler `/api/v1/health`
- [ ] `apps/web` — базовый layout с темизацией
- [ ] `packages/core` — сервисный слой
- [ ] `packages/ui` — UI-кит
- [ ] `apps/worker` — транскодинг-воркер

## Что делать дальше (следующий шаг)

Настроить базовый layout `apps/web` с темизацией (CSS-переменные + Tailwind токены)
и наладить Auth.js для первого flow аутентификации.
