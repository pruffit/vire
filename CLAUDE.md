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

### Лейаут и скролл (app-shell)

Корневой `app/layout.tsx` — это app-shell фиксированной высоты: `<html h-full>`,
`<body h-full overflow-hidden>`. Скролла на уровне документа нет. Внутри:

```
body (h-full, overflow-hidden, flex flex-col)
  Nav                                  — закреплён сверху
  div (flex-1, min-h-0, overflow-y-auto, pb-16, flex flex-col)  — единственная скролл-область
    {children}
  Player                               — fixed снизу (pb-16 резервирует под него место)
```

Правила, чтобы не вернуть «лишний» скролл документа:

- **Никогда `min-h-screen` / `h-screen` на страницах и лейаутах.** 100vh + высота Nav +
  резерв под плеер всегда дают переполнение. Высоту даёт скролл-область, страница
  заполняет её через `min-h-full` (фон на всю область) или `flex-1` (если нужно
  центрировать контент по вертикали).
- Скролл — внутри контентных модулей, а не страницей целиком. Если модуль (таблица,
  длинный список, сайдбарный лейаут) может переполниться — вешай `overflow-y-auto` +
  `min-h-0` на него, а не на страницу. Пример: `app/admin/layout.tsx` — сайдбар
  закреплён, скроллится только `<main>`.
- Инвариант защищён тестом `app/__tests__/layout-shell.test.ts`.

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
pnpm --filter @vire/db db:make-admin <email> [role]  # выдать роль (default SUPERADMIN); юзер должен перелогиниться
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

**Этап 1 (Friends & Family) — завершён.** Этап 2 (прямые продажи) — частично.

### Фундамент
- [x] Монорепо (Turborepo + pnpm), docker-compose (postgres/redis/minio)
- [x] `packages/db` — Drizzle схема 16 таблиц + миграции 0000–0003
- [x] `packages/core` — Result<T,E>, domain types, сервисы, репозитории
- [x] `packages/ui` — OKLCH-токены, Button, Card, Input
- [x] `packages/config` — tsconfig/eslint/tailwind пресеты
- [x] Auth.js v5 — Yandex OAuth + Resend magic link, JWT, `proxy.ts`
- [x] `apps/worker` — BullMQ + ffmpeg → HLS + waveform peaks → S3 → DB; play-events; notify-release

### Публичные страницы
- [x] `/` — главная (hero-поиск), `/artists` — каталог + поиск, `/search` — поиск SSR
- [x] `/artists/[slug]` — профиль: темизация, grain, ссылки, видео-эмбеды, follow-кнопка
- [x] `/artists/[slug]/releases/[releaseId]` — релиз, трек-лист, liner notes, credits
- [x] `.../tracks/[trackId]` — waveform-плеер, BPM/key, like, покупка/скачивание
- [x] `/feed` — лента подписок, `/profile` — лайки, подписки, покупки
- [x] Глобальный плеер — Zustand + HLS.js + SVG waveform scrubber

### Dashboard артиста (`/dashboard`)
- [x] Список релизов со статусами + статистика прослушиваний
- [x] `/dashboard/releases/new` — создание релиза; `/dashboard/releases/[id]` — редактирование
- [x] `/dashboard/profile` — имя, bio, аватар, тема (live color picker), grain, шрифты
- [x] Загрузка треков (FLAC → S3 → BullMQ), PublishButton (DRAFT→PUBLISHED/SCHEDULED)

### Backoffice (`/admin`, только MODERATOR/ADMIN/SUPERADMIN)
- [x] Статистика, `/admin/users`, `/admin/tracks`, `/admin/releases` со сменой роли/статуса

### Этап 2 (прямые продажи) — частично
- [x] Покупка трека: `POST /api/v1/tracks/[id]/purchase` → YooKassa redirect → webhook → PAID
- [x] Скачивание FLAC по presigned S3 URL; список покупок в `/profile`
- [ ] **YooKassa боевая настройка** — SHOP_ID/SECRET_KEY + вебхук в кабинете ЮKassa

### Тесты
- [x] `packages/core` — сервисы artist/release/track, Result/errors (Vitest)
- [x] `apps/web/lib/embed` — парсинг YouTube/VK; `apps/web/lib/upload` — хелперы валидации
- [x] Route handlers Этап 1 (права + валидация): upload, dashboard releases (create/edit/status),
  dashboard profile, follow, like, play, download — `app/api/**/route.test.ts`
- [x] App-shell лейаут — инвариант `app/__tests__/layout-shell.test.ts` (нет `min-h-screen`)
- [ ] Route handlers Этап 2 (purchase, webhooks/yookassa) — не покрыты
- [ ] `apps/worker` — не покрыт

## Что делать дальше (следующий шаг)

Этап 1 закрыт. В рамках доводки:
1. **Вынести дублирующиеся хелперы** (`fmt`, `pluralTracks`, `totalDuration`) в `shared` + тесты
2. **Тесты на `apps/worker`** (transcode-пайплайн) и на Этап-2 роуты (purchase/webhook)
3. **YooKassa боевая настройка** (Этап 2) — по отдельной команде

> ⚠️ Не интерполируй JS-`Date` в raw-`sql`-шаблон Drizzle — postgres.js получает её как
> нетипизированный bind-параметр и падает с `ERR_INVALID_ARG_TYPE: Received an instance of Date`.
> Считай дату на стороне SQL (`now() - interval '7 days'`). Через `.set({ updatedAt: new Date() })`
> на типизированной timestamp-колонке `Date` передавать можно — Drizzle знает тип.
> (Передавать `Date` в пропсах Client Component, наоборот, можно — React 19 Flight это сериализует.)
