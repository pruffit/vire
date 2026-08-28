# Vire — фактическое состояние системы

**Дата:** 28.08.2026 · **Версия:** v1.51.6 · **Метод:** чтение кода, не документации
**Предшественник:** `docs/architecture-audit.md` (Phase 0, v1.49.4) — этот документ его
не заменяет, а обновляет и достраивает тем, чего там нет (медиа, наблюдаемость, клиенты).

Всё ниже проверено в репозитории. Где утверждение не проверено — сказано явно.

---

## 1. Масштаб

| Область | Файлов | Строк | Роль |
|---|---:|---:|---|
| `apps/web` | 956 | 81 180 | Next.js 16: фронт + 127 route handlers |
| `packages/core` | 193 | 19 051 | Домен и платформа, чистый TS |
| `packages/db` | 112 | 10 766 | Drizzle: схема, 58 миграций, репозитории, `queries/` |
| `apps/mobile` | 95 | 9 377 | React Native + Expo (Android) |
| `apps/worker` | 51 | 4 215 | 12 BullMQ-воркеров в одном процессе |
| `packages/api-contracts` | 26 | 1 083 | zod-контракты |
| `apps/desktop` | 3 | 323 | Tauri v2 (Rust-обвязка) |
| прочие пакеты | 35 | 2 342 | ui, storage, i18n, design-tokens, media, api-client, config |

**Итого ~127 000 строк.** Это не прототип и не MVP.

**Тесты — прогнаны, а не взяты из документации:**

| Пакет | Файлов | Тестов | Результат |
|---|---:|---:|---|
| `@vire/web` | 286 | 2026 | ✅ 107 с |
| `@vire/core` | 64 | 1058 | ✅ |
| `@vire/mobile` | 25 | 210 | ✅ |
| `@vire/worker` | 14 | 111 | ✅ |
| **Итого** | **389** | **3405** | **все зелёные** |

`CLAUDE.md` заявляет 1777 тестов в web — цифра занижена на 249.

---

## 2. Приложения

### `apps/web` — Next.js 16.2.11 / React 19.2.4
Фронт и API в одном процессе. App Router, локали `ru`/`en` через `next-intl`.
127 route handlers (`/api/v1/*`), Server Components для чтения, server actions для форм.
Прод — standalone-сборка, запускается из `.next/standalone/apps/web/server.js`.

### `apps/worker` — Node 22 + tsx
Один процесс, 12 воркеров BullMQ: `transcode`, `analyze`, `analyze-genre`, `play-events`,
`notify-release`, `notify-external`, `editorial`, `scheduled-publish`, `fulfill-presave`,
`metrics-daily`, `jam-reaper`, `storage-cleanup`. Пять — по расписанию через
`upsertJobScheduler` (идемпотентно при рестарте).

Крах процесса перехватывается (`uncaughtException`/`unhandledRejection`) → алерт с
ожиданием доставки → `exit(1)`. Без этого загрузки молча зависали бы в `PROCESSING`.

### `apps/mobile` — React Native 0.86 / Expo 57, Android
Нативный звук `react-native-track-player` (с локальным патчем), Skia, Reanimated 4,
E2EE-чат на tweetnacl, офлайн-скачивание, пуши Expo→FCM.
Один локальный нативный модуль на Kotlin — `modules/glass-lens` (см. §7).

### `apps/desktop` — Tauri v2
Только Rust-обвязка (323 строки): окно, трей, медиа-клавиши, автообновление, мини-плеер.
Рендерит веб через системный WebView — собственного UI-кода нет.

---

## 3. Слои: что заявлено и что фактически

Заявлено в `CLAUDE.md`: `Route → Service (core) → Repository (db) → Postgres`.

**Фактически путей два.** Второй в `CLAUDE.md` не описан:

```
ЗАПИСЬ:  Route Handler → Service (core) → Repository (db) → Postgres
ЧТЕНИЕ:  Server Component → packages/db/src/queries/*.ts → Postgres
         Route Handler    → packages/db/src/queries/*.ts → Postgres
```

`packages/db/src/queries` — **50 файлов, 7 235 строк**, ~150 экспортов, 240 файлов-потребителей
в `apps/web`. Там физически живёт логика чтения: ранжирование, агрегации, фильтры видимости.
Соответствия в `core` у этого слоя нет.

Это не деградация — правило про чтения просто никогда не формулировалось.
Последствие конкретное: «вынести core» ≠ «вынести бизнес-логику».

**Что изменилось с Phase 0 (v1.49.4 → v1.51.6):**

| Блокер Phase 0 | Статус сейчас | Доказательство |
|---|---|---|
| Б1 read-путь вне HTTP | **закрыт для клиентов** | `/v1/artists`, `/v1/releases`, `/v1/feed`, `/v1/home/*`, `/v1/screens/home` (SDUI), `*/page`-эндпоинты |
| Б4 RBAC размазан по 19 файлам | **закрыт** | `core/platform/access/{can,permissions}.ts`; inline-проверок роли осталась **1** |
| Б5 контракты не централизованы | **закрыт** | `api-contracts` вырос с 3 до 26 файлов; гейт `check:contracts` |
| Б6 только cookie-auth | **закрыт** | `identity/services/device-auth.ts`, `/v1/auth/devices`, `/v1/auth/refresh` |
| Б1 read-путь внутри веба | **открыт** | 7 235 строк `queries/` по-прежнему в обход core |

Четыре из пяти блокеров закрыты за две минорные версии. Это быстрый темп.

---

## 4. Домен: `packages/core`

Две зоны — `platform/**` (access, billing, config, identity, messaging, notifications,
ports, sdui, search, social, storage, util) и `music/**` (audio, catalog, curation,
discovery, engagement, external, jam, marketing, playback).

**Чистота проверена, а не заявлена.** Импортов `@vire/db`, `next`, `react` — ноль.
Три совпадения grep оказались упоминаниями в комментариях (`track-moods.ts:1`,
`discovery.ts:4`, `wave.ts:14` — все объясняют, почему enum держатся строками).

Граница держится автоматом: `packages/core/scripts/check-layers.mjs` запрещает
`platform/** → music/**` и импорт `@vire/db`/`next`/`react` откуда угодно в core.
Гейт в CI (`check:layers`).

**Это редкость и это капитал.** Большинство проектов такое декларируют и не соблюдают.

---

## 5. Данные

PostgreSQL 16 + Drizzle. 20 файлов схемы, **58 миграций** (0000–0057).

Решения, которые видно в схеме:
- `track_contributors.payout_share numeric(5,2)` — деньги не привязаны к бренду артиста
- `rights_holders` отдельно от `artist_profiles`
- `artist_members` — join `user_id ↔ artist_profile_id` + role: модель членства уже
  изоморфна платформенной (переход к `organization_members` — переименование)
- Полиморфизм без FK уже применён: `purchases.itemId`, `reports.targetId`, `play_events.trackId`
- `storage_orphans` — журнал осиротевших файлов (см. §6)
- Live-присутствие — в Redis (ZSET), не в Postgres

**Клиент БД — `packages/db/src/client.ts`:**
```ts
const client = globalForDb._pgClient ?? postgres(connectionString);
```
Пул не сконфигурирован → postgres.js берёт дефолт `max: 10`. Web и worker дают до 20
бэкендов при `max_connections=50`. Не отказ, но каждый бэкенд Postgres — это память,
и её стоит задавать осознанно, а не дефолтом драйвера.

---

## 6. Хранилище и консистентность

S3-совместимое (MinIO), два бакета: `vault` (мастера, приватный) и `stream`
(HLS + обложки, публичный через Caddy на `cdn.viremusic.ru`).

**Реконсиляция есть и она правильная.** Удаление сущности не удаляет файлы синхронно:
запись падает в `storage_orphans` (bucket, prefix, reason, attempts, lastError, cleanedAt),
а почасовой `storage-cleanup` выгребает их через `StorageCleanupService` с grace-периодом
в сутки. Падение между БД и S3 не теряет ключи.

Это прямой ответ на классический вопрос «файл загружен, транзакция упала» — механизм
на месте, с журналом, счётчиком попыток и записью последней ошибки.

---

## 7. Медиа-пайплайн

```
upload (multipart) → валидация → S3 vault → BullMQ transcode
   → ffmpeg HLS (AAC 192k, 6с сегменты) + waveform (200 пиков)
   → BPM/key (чистый JS DSP) + жанр (ONNX discogs-effnet)
   → S3 stream → транзакция: tracks.READY + track_audio upsert
```

**Идемпотентность:** job проверяет `status === 'READY'` и выходит. Финальное падение
(после исчерпания попыток) переводит `PROCESSING → FAILED` условным UPDATE — поздний
`READY`/`BLOCKED` не затирается — и шлёт письмо артисту. Никогда не бросает.

**Валидация загрузки закрыта на три замка:** расширение из закрытого union (`wav|flac|mp3`),
magic bytes, лимит 300 МБ. `sourceKey` = `tracks/{uuid}/source.{закрытый ext}` — путь целиком
серверный, обход директории невозможен. `fluent-ffmpeg` вызывает бинарь без шелла массивом
аргументов, пользовательские строки в аргументы не попадают.

**CPU-профиль (определяет §8 итогового отчёта):**
- ffmpeg — нативный C, вне event loop
- ONNX-инференс — нативный C++, но блокирует поток
- `detectBPM` / `detectKey` / `mel-spectrogram` — **~600 строк чистого JS** (автокорреляция
  O(n·lags), Goertzel по полутонам на кадр). Единственный CPU-bound JS в системе.

`lockDuration` поднят до 10 минут именно из-за этого. `concurrency: 2` у transcode.

---

## 8. Инфраструктура прода — определяющее ограничение

**Один VPS Timeweb: 2 ядра × 3.3 ГГц / 2 ГБ RAM / 40 ГБ + 4 ГБ swap.** Шесть контейнеров:
caddy, web, worker, postgres, redis, minio.

> ⚠️ **Апгрейд с 1 vCPU / 1 ГБ выполнен, документация за ним не пошла.** Старая спека
> сидит в 16 файлах `docs/` и обосновывает выводы, которые теперь под вопросом.
> Разбор — `audit-2026-08.md` §6.

Postgres: `shared_buffers=96MB`, `effective_cache_size=256MB`, `work_mem=4MB`,
`max_connections=50`. **Эти цифры считались от 1 ГБ и после апгрейда не пересматривались** —
база сейчас недообеспечена относительно машины, на которой стоит.
Redis: `--save 60 1 --appendonly no`, noeviction (обязателен для BullMQ).
Образы собираются в GitHub Actions (2 ГБ не тянет `next build`) и тянутся из GHCR.

**Лимитов памяти у контейнеров нет** (`mem_limit`/`deploy.resources` — ноль совпадений).
Подушка — только 4 ГБ swap и `vm.swappiness=10`. При пике OOM-killer выбирает жертву
сам, и это может оказаться Postgres, а не воркер.

Два ядра означают, что `concurrency: 2` у транскода — по задаче на ядро, то есть
конфигурация корректна, а не избыточна.

---

## 9. Наблюдаемость

Без внешних платных сервисов. Решение принималось на 1 ГБ («Sentry не влез»); после
апгрейда до 2 ГБ это основание отпало — остаётся только блокировка sentry.io в РФ,
которая закрывается self-hosted GlitchTip. Вопрос стоит переоткрыть.

- `GET /api/health` — пинг Postgres + Redis, `200 ok` / `503 degraded`, отдаёт версию
- `instrumentation.ts → onRequestError` — ошибки серверных роутов, с фильтром известного
  шума (два апстрим-бага Next/Node, задокументированы поимённо)
- Воркер: `alertJobFailure` (упавший джоб), `alertWorkerError` (обрыв Redis),
  `alertCrash` (падение процесса). Каналы: Telegram + webhook, оба опциональны
- Троттлинг: одинаковый текст не чаще раза в 60 с на процесс, решение принимается
  до веера по каналам

**Чего нет:** трейсов, метрик как временных рядов (кроме суточных снапшотов
`platform_metrics_daily`), телеметрии длительности джобов, профиля запросов к БД.
Система отвечает на «что упало» и «упало ли», но не на «почему медленно».

---

## 10. Безопасность — фактическое покрытие

| Область | Состояние | Проверено |
|---|---|---|
| Загрузка файлов | ext-whitelist + magic bytes + лимит 300 МБ | да, `lib/upload.ts` |
| Инъекция в ffmpeg | невозможна (spawn массивом, пути серверные) | да |
| Обход директории | невозможен (ключ из uuid + закрытый union) | да |
| RBAC | централизован в `core/access`, гейт `check:caller` | да |
| Актор в роутах | `getCaller()` в 84 роутах, гейт в CI | да |
| Валидация входа | zod в 31 роуте напрямую + контракты в `api-contracts` | да |
| Rate limiting | Redis fixed-window, 38 роутов из 127, fail-open | да |
| Секреты в истории git | `.env` не коммитился ни разу; FCM-креды в `.gitignore` | да |
| Вебхук YooKassa | подпись тела не проверяется, но платёж перезапрашивается из API | да |
| CORS | не настроен | да |
| Tenant isolation | отсутствует | да |

Не проверено построчно: IDOR в `playlists/[id]/collaborators/*`, `chat/*`,
`friends/[userId]`. Требует прицельного прохода — эти маршруты работают с чужими id.

---

## 11. CI/CD

`ci.yml` — на пуш в `dev`. `deploy.yml` — по тегу `vX.Y.Z`.

Job `gates`: design-tokens build → typecheck (turbo, фанаут по всем пакетам) → lint →
check:routes → check:i18n → check:layers → check:contracts → check:caller → test →
`pnpm audit --audit-level=high` → `audit:design` (Impeccable) → build → **smoke**
(поднимает прод-артефакт и дёргает `/robots.txt`).

Восемь статических барьеров — заметно больше, чем в среднем проекте такого размера,
и каждый вырос из реального инцидента (в `CLAUDE.md` описаны поимённо).

**Слабое место:** нет path-фильтрации. Правка в `apps/mobile` гоняет весь монорепо,
включая сборку веба. Кэш есть (pnpm + docker gha), фильтров нет.
