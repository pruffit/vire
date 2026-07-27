# VireMusic

Независимая музыкальная площадка для артистов и слушателей СНГ. Место, где артист владеет своей музыкой, получает деньги напрямую и выглядит как артист, а не как трек в чужом алгоритме.

> **v1.0.0** · Этап 1 (Friends & Family) — запущен

---

## Документация

Читать в этом порядке:

1. [`docs/vision/concept.md`](docs/vision/concept.md) — продукт и видение: зачем, для кого, четыре этапа развития, юридика, фичи.
2. [`docs/foundation/architecture.md`](docs/foundation/architecture.md) — технический фундамент: стек, структура монорепо, принципы, отказоустойчивость.
3. [`docs/foundation/data-schema.md`](docs/foundation/data-schema.md) — модель данных: сущности, связи, решения «на вырост».
4. [`docs/ops/deployment.md`](docs/ops/deployment.md) — деплой на VPS: Docker Compose, Caddy, CI/CD, бэкапы.

Карта всех документов — [`docs/README.md`](docs/README.md).

---

## Стек

- **Монорепо:** Turborepo + pnpm
- **Фронт + API:** Next.js 15 (App Router), TypeScript strict
- **UI:** Radix Primitives / shadcn (headless) + Tailwind — кастомные OKLCH-токены
- **База:** PostgreSQL + Drizzle ORM
- **Очередь:** Redis + BullMQ
- **Хранилище:** S3-совместимое (MinIO локально и на проде, внешний S3 при росте)
- **Транскодинг:** ffmpeg-воркер (HLS-нарезка + waveform-пики)
- **Аутентификация:** Auth.js v5 — Yandex OAuth + Resend magic-link
- **Деплой:** Timeweb Cloud VPS + Docker Compose + Caddy (авто-TLS)

---

## Структура

```
apps/
  web/        — Next.js: фронт + API (Route Handlers /api/v1/*)
  worker/     — BullMQ воркеры: транскодинг, рассылки
packages/
  core/       — бизнес-логика, use-cases (чистый TS, не зависит от Next)
  db/         — Drizzle схема + миграции + клиент (@vire/db)
  api-contracts/ — zod-схемы запросов/ответов, общие типы
  api-client/ — типизированный fetch-клиент
  ui/         — общий UI-кит (Radix + кастомный Tailwind)
  media/      — утилиты HLS, waveform
  config/     — tsconfig, eslint, tailwind preset
docs/         — документация проекта
```

---

## Разработка

> Требования: Node >= 22, pnpm >= 10, Docker.

```bash
# поднять локальную инфраструктуру (postgres, redis, minio)
docker compose up -d

# установить зависимости
pnpm install

# запустить дев-режим (web + worker)
pnpm dev
```

Переменные окружения: скопируй `.env.example` в `.env` и заполни.

---

## Ветки и CI/CD

| Ветка | Назначение |
|---|---|
| `dev` | текущая разработка; CI (тесты + линт + сборка) на каждый пуш |
| `main` | стабильный код; изменения через PR из `dev` |
| тег `vX.Y.Z` | запускает полный деплой: gates → сборка образов → выкатка на прод |

Образы собираются в **GitHub Actions** (раннер с достаточным RAM) и пушатся в GHCR — сервер только тянет готовые образы. Подробности — в [`docs/ops/deployment.md`](docs/ops/deployment.md).

---

## Лицензия

Приватный проект. Все права защищены.
