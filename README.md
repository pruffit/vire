# vireSpace

Платформа для продуктов, где автор владеет тем, что создал: своей страницей, ценой,
данными и связью с аудиторией — без посредника, решающего за него.

**VireMusic** — первый продукт на ней и пока единственный: независимая музыкальная
площадка для артистов и слушателей СНГ. Артист владеет своей музыкой, получает деньги
напрямую и выглядит как артист, а не как трек в чужом алгоритме.

Платформа здесь — не заявление о намерениях: ядро уже разделено на переиспользуемое
(`packages/core/src/platform/**` — идентичность, биллинг, уведомления, поиск, соцсвязи,
сообщения) и музыкальное (`music/**`), а барьер `check:layers` не даёт первому узнать
о втором. Что из этого выносится в публичные SDK и по какому графу зависимостей —
[`docs/virespace.md`](docs/virespace.md).

> **VireMusic:** этап 1 (Friends & Family) запущен; этап 2 (прямые продажи) — частично,
> бэкенд покупок готов, UI скрыт с витрины до боевой настройки YooKassa.
> **Платформа:** волны 0–8 разделения выполнены, открыты 9–11 (организации,
> полиморфные взаимодействия, CI под несколько продуктов).

---

## Документация

Читать в этом порядке:

1. [`docs/vision/concept.md`](docs/vision/concept.md) — продукт и видение: зачем, для кого, четыре этапа развития, юридика, фичи.
2. [`docs/foundation/architecture.md`](docs/foundation/architecture.md) — технический фундамент: стек, принципы, отказоустойчивость.
3. [`docs/foundation/data-schema.md`](docs/foundation/data-schema.md) — модель данных: сущности, связи, решения «на вырост».
4. [`docs/ops/deployment.md`](docs/ops/deployment.md) — деплой на VPS: Docker Compose, Caddy, CI/CD, бэкапы.

Фактическое состояние кодовой базы (а не целевое) — [`docs/architecture/current-state.md`](docs/architecture/current-state.md).
Инженерный аудит с решениями и дорожной картой — [`docs/architecture/audit-2026-08.md`](docs/architecture/audit-2026-08.md).
Карта всех документов — [`docs/README.md`](docs/README.md). Каждая фича описана файлом в [`docs/features/`](docs/features/).

---

## Стек

- **Монорепо:** Turborepo + pnpm workspaces
- **Фронт + API:** Next.js 16 (App Router), React 19, TypeScript strict
- **UI:** свой headless-кит на Tailwind v4 с OKLCH-токенами — без UI-фреймворка
- **База:** PostgreSQL 16 + Drizzle ORM
- **Очередь:** Redis + BullMQ
- **Хранилище:** S3-совместимое (MinIO локально и на проде, внешний S3 при росте)
- **Транскодинг:** ffmpeg-воркер (HLS-нарезка, waveform-пики, BPM/тональность, жанр через ONNX)
- **Аутентификация:** Auth.js v5 — email/пароль, magic link, Yandex OAuth; Bearer-токены устройств для нативных клиентов
- **Почта:** Brevo HTTP API (SMTP-порты у хостера закрыты)
- **Локализация:** ru / en через `next-intl`
- **Деплой:** Timeweb Cloud VPS + Docker Compose + Caddy (авто-TLS)

---

## Структура

```
apps/
  web/        — Next.js: фронт + API (Route Handlers /api/v1/*)
  worker/     — BullMQ: транскодинг, анализ аудио, рассылки, крон-задачи
  mobile/     — React Native + Expo (Android)
  desktop/    — Tauri v2 (Windows / Linux), UI через системный WebView
packages/
  core/           — бизнес-логика и use-cases (чистый TS, не знает ни Next, ни БД)
  db/             — Drizzle: схема, миграции, репозитории, запросы чтения
  api-contracts/  — zod-схемы запросов/ответов, общие типы
  api-client/     — типизированный fetch-клиент
  ui/             — общие UI-примитивы
  storage/        — S3-адаптер (один клиент на web и worker)
  media/          — утилиты HLS
  i18n/           — словари ru/en и хелперы локали
  design-tokens/  — токены дизайна в платформо-нейтральном формате
  config/         — пресеты tsconfig / eslint / tailwind
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

> ⚠️ Треки висят в `PROCESSING`? Не запущен **worker**. `pnpm dev` из корня поднимает
> и web, и worker; отдельно — `pnpm --filter @vire/worker dev`.

### Проверки качества

```bash
pnpm turbo run typecheck              # все пакеты
pnpm --filter @vire/web lint
pnpm --filter @vire/web test          # vitest
pnpm turbo run check:layers           # границы @vire/core
pnpm --filter @vire/web check:routes  # конфликты динамических сегментов
pnpm --filter @vire/web check:i18n    # кириллица вне словарей
pnpm --filter @vire/web audit:design  # Impeccable
pnpm audit --audit-level=high         # гейт CI, локально легко забыть
```

Полный список и объяснение, зачем каждый барьер, — в [`CLAUDE.md`](CLAUDE.md).

---

## Ветки и CI/CD

Разработка идёт **прямо в `main`**. PR-цикла и ветки `dev` нет: разработчик один,
ревью самому себе ничего не ловит, а вот гейты — ловят.

| Триггер | Что происходит |
|---|---|
| пуш в `main` | CI: гейты (typecheck, lint, 6 барьеров, тесты, audit, сборка). Пропускается, только если в коммите нет ничего, кроме документации |
| тег `vX.Y.Z` | полный деплой: гейты → сборка образов → выкатка на прод. Фильтров нет: релиз прогоняет всё |

Защита от ошибки — не процесс, а автоматика: восемь статических барьеров в CI,
каждый вырос из реального инцидента на проде.

Образы собираются в **GitHub Actions** (у сервера не хватит RAM на `next build`) и пушатся
в **GHCR** — сервер только тянет готовые. Подробности — [`docs/ops/deployment.md`](docs/ops/deployment.md).

---

## Лицензия

Приватный проект. Все права защищены.
