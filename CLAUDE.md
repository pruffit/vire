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
  div (flex-1, min-h-0, overflow-y-auto)  — единственная скролл-область (обычный блок!)
    {children}
  Player                               — элемент потока снизу (h-16), только когда играет
```

Правила, чтобы не вернуть «лишний» скролл документа:

- **Никогда `min-h-screen` / `h-screen` на страницах и лейаутах.** 100vh + высота Nav +
  плеер всегда дают переполнение. Высоту даёт скролл-область, страница заполняет её
  через `min-h-full` (фон на всю область; центрирование — `min-h-full flex … justify-center`).
- **Скролл-область — НЕ flex-контейнер.** Если сделать её `flex flex-col`, дочерняя страница
  становится flex-элементом с `flex-shrink:1` и при высоком контенте сжимается до высоты
  области (особенно с `min-h-full`), контент вываливается под плеер, а скролл не появляется.
  Обычный блок со `overflow-y-auto` скроллится корректно.
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

Схема в `packages/db/src/schema/`, ключевые решения:

- `track_contributors` с `payout_share numeric(5,2)` — не `artist_id` в треке напрямую
- `rights_holders` отдельно от `artist_profiles` (бренд ≠ получатель денег)
- Файлы в S3 по `/vault/tracks/{track_id}/source.flac` — не по артисту
- `play_events` — аналитический лог, пишется через буфер, не прямым инсертом
- `theme_tokens` JSONB в профиле артиста — темизация на уровне данных
- `subscriptions.type` полиморфный: `ARTIST_TIER` | `LISTENER_PREMIUM`
- `artist_posts` — анонсы/новости артиста (FK на профиль, `onDelete: cascade`)
- Live-присутствие («слушают сейчас») живёт в Redis (ZSET), не в Postgres

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

## Проверки качества (гонять после каждого набора изменений)

```bash
pnpm --filter @vire/web typecheck      # tsc --noEmit
pnpm --filter @vire/web lint           # eslint
pnpm --filter @vire/web test           # vitest
pnpm --filter @vire/web audit:design   # Impeccable — детектор дизайн-анти-паттернов
pnpm --filter @vire/web build          # прод-сборка
```

**Impeccable** (`audit:design`) — равноправный гейт качества рядом с typecheck/lint/test:
детектит дизайн-анти-паттерны (дефолтные шрифты, серый текст на цвете, pure-gray без
подкраски, лишняя вложенность карточек, bounce-easing, низкий контраст). Закреплён как
devDependency `impeccable` (пакет = github.com/pbakaus/impeccable). Скилл-команды
`/impeccable …` (audit/critique/polish/delight) — ставятся отдельно: `npx impeccable skills install`.
Принципы Impeccable применяем по умолчанию во всей дизайн-работе.

## Текущий статус

**Этап 1 (Friends & Family) — завершён.** Этап 2 (прямые продажи) — частично.

### Фундамент
- [x] Монорепо (Turborepo + pnpm), docker-compose (postgres/redis/minio)
- [x] `packages/db` — Drizzle схема + миграции 0000–0008 (последняя — `artist_posts`)
- [x] `packages/core` — Result<T,E>, domain types, сервисы, репозитории
- [x] `packages/ui` — OKLCH-токены, Button, Card, Input
- [x] `packages/config` — tsconfig/eslint/tailwind пресеты
- [x] Auth.js v5 — Yandex OAuth + Resend magic link, JWT, `proxy.ts`
- [x] `apps/worker` — BullMQ + ffmpeg → HLS + waveform peaks → S3 → DB; play-events; notify-release

### Публичные страницы
- [x] `/` — главная (контент-хаб + кнопка запуска потока), `/artists` — каталог + поиск, `/search` — поиск SSR
- [x] `/artists/[slug]` — профиль: full-bleed hero, темизация, grain, ссылки, видео, follow, анонсы
- [x] `/artists/[slug]/releases/[releaseId]` — релиз, трек-лист, liner notes, credits
- [x] `.../tracks/[trackId]` — waveform-плеер, BPM/key, like, live-счётчик
- [x] `/feed` — лента подписок, `/profile` — карточка профиля, лайки, подписки, покупки
- [x] Глобальный плеер — Zustand + HLS.js + SVG waveform scrubber, wave-режим

### Взаимодействие слушателя (концепт «Взаимодействие слушателя» — закрыто)
- [x] Лайк трека (плеер + трек-лист + страница трека, синхронизация состояния)
- [x] Плейлисты — `/playlists/[id]`, добавление трека, приватность, переименование/удаление
- [x] Теги настроения (`track_moods`) + mood-picker; **Волна** ступени 1 (теги+BPM+тональность),
  seed-режим, автоплей при исчерпании очереди
- [x] Любимые моменты — анонимные маркеры на волне (`favorite_moments`), агрегат на странице трека
- [x] Шеринг с таймкодом — `TrackShare` поповер (ссылка / «с момента M:SS») в плеере и на треке
- [x] Live «слушают сейчас» — Redis-присутствие (ZSET + окно 45с), heartbeat из плеера;
  показ слушателю (трек) и артисту (дашборд); деградирует до 0 при сбое Redis (`lib/presence.ts`)

### Dashboard артиста (`/dashboard`)
- [x] Список релизов со статусами + статистика прослушиваний + live «слушают сейчас» в шапке
- [x] `/dashboard/releases/new` — создание релиза; `/dashboard/releases/[id]` — редактирование
- [x] `/dashboard/profile` — имя, bio, аватар, тема (live color picker, расширенные пресеты), grain, шрифты
- [x] `/dashboard/posts` — анонсы/новости: композер + инлайн-редактирование + оптимистичное удаление
- [x] Загрузка треков (FLAC → S3 → BullMQ), PublishButton (DRAFT→PUBLISHED/SCHEDULED)
- [x] Аналитика переслушиваний — возвраты к треку (2+ разных дня) в `StatsSection`

### Backoffice (`/admin`, только MODERATOR/ADMIN/SUPERADMIN)
- [x] Обзор: «требует внимания» (зависшие/заблокированные треки, неверифицированные артисты);
  **система** (пинг Postgres/Redis, live-слушатели, BullMQ-очереди с ошибками — `lib/admin-health.ts`);
  аудитория/каталог (юзеры по ролям, артисты, релизы/треки по статусам); вовлечённость
  (прослушивания 24ч/7д/30д, уник. слушатели, лайки/подписки/плейлисты/посты/теги/моменты)
- [x] `/admin/analytics` — динамика прослушиваний по дням (14д), топ треков/артистов за 30д
- [x] `/admin/users` (смена роли + верификация), `/admin/artists` (фолловеры/релизы/прослушивания,
  верификация + скрытие с витрины isActive), `/admin/tracks` (аудио-характеристики, прослушивания,
  лайки, маркер `!hls`), `/admin/releases` (смена статуса)

### SEO и доступность
- [x] `metadataBase` + title-template `%s — Vire`, OG/Twitter дефолты (`app/layout.tsx`, `lib/site.ts`)
- [x] `generateMetadata` артиста/релиза/трека: canonical + OG `profile`/`music.album`/`music.song`
- [x] `app/robots.ts`, `app/sitemap.ts` (артисты + релизы из БД), `app/manifest.ts`
- [x] Schema.org JSON-LD — `MusicGroup`/`MusicAlbum`/`MusicRecording` (`lib/structured-data.ts`,
  `<JsonLd>`); билдеры — чистые функции, покрыты тестами
- [x] a11y: skip-link, `:focus-visible` обводка, `cursor: pointer` на кнопках (Tailwind v4 убрал
  дефолт), `prefers-reduced-motion` глушит анимации; entrance-анимация `animate-fade-up`
- Базовый URL — `NEXT_PUBLIC_SITE_URL` → `AUTH_URL` → localhost (`lib/site.ts`)

### Этап 2 (прямые продажи) — частично, UI скрыт с витрины
**Покупок в Этапе 1 нет:** весь purchase-UI отвязан от публичных страниц до старта Этапа 2.
Бэкенд-код сохранён: API-роуты (purchase/download/webhook), `download-button.tsx` и
`purchased-track-row.tsx` лежат неподключёнными — вернуть при старте Этапа 2.
- [x] Покупка трека: `POST /api/v1/tracks/[id]/purchase` → YooKassa redirect → webhook → PAID
- [x] Скачивание FLAC по presigned S3 URL
- [ ] **YooKassa боевая настройка** — SHOP_ID/SECRET_KEY + вебхук в кабинете ЮKassa

### Тесты (apps/web — 125, гонять `pnpm --filter @vire/web test`)
- [x] `packages/core` — сервисы artist/release/track, Result/errors (Vitest)
- [x] `apps/web/lib` — `embed` (YouTube/VK), `upload` (валидация), `format`, `structured-data` (JSON-LD билдеры)
- [x] Route handlers Этап 1 (права + валидация): upload, dashboard releases (create/edit/status),
  dashboard profile, dashboard posts (create/edit/delete), follow, like, play, download,
  tracks/listening (presence) — `app/api/**/route.test.ts`
- [x] App-shell лейаут — инвариант `app/__tests__/layout-shell.test.ts` (нет `min-h-screen`)
- [x] `apps/worker` — transcode-пайплайн (`processTranscodeJob`: идемпотентность, derive ext,
  HLS-загрузка, READY-транзакция, fallback на ffprobe) + waveform-пики (`peaksFromPcm`)
- [ ] Route handlers Этап 2 (purchase, webhooks/yookassa) — не покрыты

## Что делать дальше (следующий шаг)

Этап 1 закрыт, включая все взаимодействия слушателя из концепта. Дальше — только Этап 2:
1. **Тесты Этап-2 роутов** (purchase/webhook) и **YooKassa боевая настройка** — по команде

Сделано в доводке:
- Форматтеры (`formatDuration`, `formatCount`, `pluralTracks`, `releaseYear`, `totalDuration`)
  централизованы в `apps/web/lib/format.ts` и покрыты тестами.
- Все удалённые изображения (обложки/аватары из S3) — на `next/image`; хост S3/MinIO задаётся
  через `images.remotePatterns` в `next.config.ts` из `S3_PUBLIC_ENDPOINT`. Также разрешён
  `avatars.yandex.net` (OAuth-аватары Yandex). Локальные blob-превью в формах остаются `<img>`
  (next/image не оптимизирует blob:). После правки `next.config.ts` dev-сервер нужно перезапустить.
- Live-присутствие использует Redis напрямую (`ioredis`, `lib/presence.ts`) — отдельно от BullMQ-очередей,
  но тот же `REDIS_URL`. Все presence-эндпоинты деградируют до `count:0` при недоступности Redis.

> ⚠️ Не интерполируй JS-`Date` в raw-`sql`-шаблон Drizzle — postgres.js получает её как
> нетипизированный bind-параметр и падает с `ERR_INVALID_ARG_TYPE: Received an instance of Date`.
> Считай дату на стороне SQL (`now() - interval '7 days'`). Через `.set({ updatedAt: new Date() })`
> на типизированной timestamp-колонке `Date` передавать можно — Drizzle знает тип.
> (Передавать `Date` в пропсах Client Component, наоборот, можно — React 19 Flight это сериализует.)
