# API-контракты — конвенции и первая группа

**Статус:** реализовано (Phase 4, волна 3, 12.08.2026) · **Основание:** `architecture-audit.md` §Б5,
`migration-plan.md` §волна 3

---

## 1. Проблема

`packages/api-contracts` покрывает ~4 эндпоинта (follow/like/presave/wave). Реальная
валидация — **48 zod-схем, разбросанных по `app/api/v1/**/route.ts`**. Единого места,
откуда клиент импортирует контракты, нет.

Плюс расхождения, которые надо закрыть до появления второго клиента: формы ответов,
пагинация, коды ошибок, сериализация дат.

---

## 2. Источник правды — zod

Проект уже выводит типы из zod. Это сохраняется:

```
zod-схема (packages/api-contracts)
   ├── z.infer          → типы для TS-клиентов (веб, React Native)
   ├── валидация входа  → route handler
   ├── contract-тест    → ответ роута парсится этой же схемой
   └── JSON Schema      → генерируется для не-TS клиентов, если появятся
```

OpenAPI **не вводится сейчас**: при TS-клиенте (`multiplatform.md` §3) он даёт
генератор, который надо поддерживать, без новой возможности. Генерация JSON Schema
из zod — одна команда, вводится в момент появления не-TS клиента.

---

## 3. Конвенции

### 3.1 Форма ответа

Факт (принято волной 3): роут отдаёт **ресурсный объект напрямую**, не обёртку `{ data }`.
`{ items, hasMore }`, `{ liked }`, `{ playlist }` — форма определяется ресурсом, схема
живёт в `packages/api-contracts`. Обёртка не даёт типизированному клиенту ничего, а
миграция 119 роутов и всех фетчеров — ломающее изменение без выигрыша.

```ts
// успех — ресурсный объект (пример: LikeResponse)
{ liked: boolean }

// ошибка — errorResponseSchema, common.ts
{ error: string, code?: string }
```

`error` — техническое сообщение (обычно русское, для логов), сериализуется в
`apps/web/lib/error-response.ts` (`errorJson`) из `Result<T,E>` сервиса core. `code` —
**необязательное** машиночитаемое поле для клиентского перевода
(`apps/web/lib/api-error.ts` → `packages/i18n/messages/*/errors.json`) — совместимое
расширение поверх факта, наполняется по мере надобности (волна 4, мобильный клиент).

### 3.2 Коды статусов

| Код | Когда |
|---|---|
| 200 / 201 | Успех / создано |
| 400 | Не прошло валидацию (`validation_failed`) |
| 401 | Не аутентифицирован |
| 403 | Аутентифицирован, но нет права (единый гейт `can()`) |
| 404 | Не найдено **или** нет права видеть — не раскрывать существование чужого ресурса |
| 409 | Конфликт состояния |
| 429 | Рейт-лимит |

### 3.3 Правила полей

- **Именование:** `camelCase` везде. Snake_case остаётся внутри БД и не выходит наружу.
- **Даты:** ISO-8601 UTC строкой. Core-типы держат `Date` — маппинг явный, на границе.
  Без этого типы core нельзя переиспользовать как контракт.
- **Деньги:** целое в минорных единицах + `currency`. Никогда `float`.
- **Идентификаторы:** строки. Внутренние поля БД наружу не протекают.
- **Пагинация:** `limit`/`offset` + `meta.total`. Курсорная — только там, где offset
  доказанно не тянет, не по умолчанию.
- **Сортировка:** `sort=field:asc|desc` из закрытого списка полей.

### 3.4 Версионирование

`/api/v1` — существующий префикс (107 из 109 роутов уже там), сохраняется.

Внутри v1 допустимы только совместимые изменения: новые эндпоинты, новые необязательные
поля запроса, **новые поля ответа**. Удаление поля, смена типа или смысла — только v2.

Причина строгости — мобильный клиент: старая версия приложения живёт на устройствах
месяцами, откат стоит ревью в сторе.

---

## 4. Структура пакета

Плоская, не `common/platform/music`: 17 файлов сегодня, порог для раскладки по
подпапкам — 30 (`migration-plan.md` §волна 3, решение 2). Реэкспорт — `src/index.ts`.

```
packages/api-contracts/src/
├── common.ts            errorResponseSchema, okResponseSchema, uuidSchema
├── artist.ts             GET /v1/artists/{slug} (ресурсный)
├── artist-page.ts         GET /v1/artists/{slug}/page (экран)
├── artist-catalog.ts      GET /v1/artists (каталог)
├── release.ts             GET /v1/releases/{id} (ресурсный)
├── release-page.ts        GET /v1/releases/{id}/page (экран)
├── release-catalog.ts     GET /v1/releases (каталог)
├── catalog.ts             общие схемы каталога (artistProfileSchema, releaseSchema, ...)
├── playlist.ts             CRUD плейлиста, tracks, collaborators, add-search, cover, suggestions
├── playlist-page.ts        GET /v1/playlists/{id}/page (экран) + переиспользуемые
│                           playlistTrackSchema/playlistCollaboratorSchema/playlistWithTracksSchema
├── toggle.ts               follow/like/presave (общая форма { <flag>: boolean })
├── wave.ts                 GET /v1/wave
├── feed.ts                 GET /v1/feed
├── home-blocks.ts          6 эндпоинтов GET /v1/home/*
├── chat.ts                 chat/** — сообщения, беседы, unread-count
├── notifications.ts        notifications/**
└── index.ts                barrel — export * из всех файлов выше
```

---

## 5. Первая группа сущностей

Отбор по критерию «минимум, на котором мобильный клиент показывает каталог, плеер
и профиль» — то есть по реальному потребителю, а не по алфавиту.

| # | Ресурс | Эндпоинты | Статус сегодня |
|---|---|---|---|
| 1 | **Artist** | `GET /v1/artists/{slug}/page`, `GET /v1/artists` | ✅ Экран через core (шаг 2.1), контракт `artistPageResponseSchema`. ✅ Каталог (шаг 2.4): `artistCatalogQuerySchema` / `artistCatalogResponseSchema`, пагинация `limit`/`offset` + `hasMore` |
| 2 | **Release** | `GET /v1/releases/{id}/page`, `GET /v1/releases` | ✅ Экран через core (шаг 2.2), контракт `releasePageResponseSchema`. ✅ Каталог (шаг 2.3): `releaseCatalogQuerySchema` / `releaseCatalogResponseSchema`, пагинация `limit`/`offset` + `hasMore`. Ресурсный `GET /v1/releases/{id}` остаётся отдельно — потребитель плеер, не экран |
| 3 | **Track** | `GET /v1/tracks/{id}`, `GET /v1/tracks/{id}/manifest` | Манифест есть. `like` — ✅ `likeResponseSchema` (`toggle.ts`). Остальное (`manifest`, `download`, `lyrics`, `moments`, `moods`, `purchase`, `listening`) — allowlist `check:contracts`, точечный остаток волны 3 |
| 4 | **Playlist** | `GET /v1/playlists/{id}/page`, `GET /v1/playlists/{id}`, CRUD | ✅ Экран через core (шаг 2.5), контракт `playlistPageResponseSchema` (discriminated union по `kind`). ✅ Весь `playlists/**` кроме SSE-стрима на контрактах (`playlist.ts`, срез 2 волны 3) |
| 5 | **Feed** | `GET /v1/feed` | ✅ `FeedService` через core (шаг 2.6), контракт `feedResponseSchema`. Персонально — 401 без сессии, `userId` только из сессии, не из query |
| 6 | **User/Profile** | `GET /v1/user/profile`, `PATCH` | Не переведён — allowlist `check:contracts` |
| 7 | **Auth** | `POST /v1/auth/token`, `/refresh`, `DELETE /devices/{id}` | **Нет** — волна 4 |
| 8 | **Interactions** | like, follow, presave | Есть, уже в контрактах |
| 9 | **Home blocks** (доп. к Playlist из #4) | `GET /v1/home/{fresh-releases,upcoming,hot-tracks,playlists,personal,friends-activity}` | ✅ `HomeBlocksService` через core (шаг 2.7), контракты `freshReleasesResponseSchema`/`upcomingResponseSchema`/`hotTracksResponseSchema`/`homePlaylistsResponseSchema`/`personalBlockResponseSchema`/`friendsActivityResponseSchema`. `personal`/`friends-activity` — 401 без сессии, `userId` только из сессии, не из query (тот же контракт, что и Feed) |

Порядок совпадает с волной 2 `migration-plan.md` — контракт пишется **вместе** с переводом
ресурса на read-сервис, не отдельной кампанией. Это то, что не даёт работе превратиться
в «большую миграцию контрактов», которая никогда не заканчивается.

---

## 6. Contract-тесты и барьер `check:contracts`

```ts
const res = await GET(request);
expect(ArtistDetailResponse.safeParse(await res.json()).success).toBe(true);
```

Тот же импорт использует клиент. Расхождение сервера и клиента падает в CI, а не в проде
на телефоне.

**Барьер введён волной 3** (`apps/web/scripts/check-contracts.mjs`, по образцу
`check-route-slugs.mjs`): каждый `app/api/v1/**/route.ts` обязан импортировать хотя бы
один символ из `@vire/api-contracts`, иначе гейт красный. Регистрация — `check:contracts`
в `apps/web/package.json` (+ `prebuild`), таск в `turbo.json`, шаг в job `gates`
(`.github/workflows/deploy.yml`).

Роут без схемы — тоже находка, а не обход: **allowlist** перечисляет непереведённые
группы явно, с причиной у каждой строки:

| Allowlist | Причина |
|---|---|
| `admin/**` | Backoffice, единственный потребитель — веб |
| `dashboard/**` | Мультипарт + ручная валидация входа, отдельный подпроект (18 роутов) |
| `jam/**` | Union-типы + SSE, отдельный подпроект (18 роутов) |
| `keys/**` | E2EE-протокол, не JSON REST контракт |
| `webhooks/**` | Форму задаёт провайдер (YooKassa), не мы |
| `**/stream/route.ts` | SSE-поток, не запрос-ответ |
| `health/route.ts` | Служебный пинг, не ресурс |
| `search`, `friends/**`, `tracks/**` (кроме `like`), `user/**`, `users/**`, `feedback`, `reports`, `session`, `presence`, `push/**`, `presave/**`, `party/**`, `listening-now`, `realtime/**` | Точечный остаток волны 3, не переведён |

Allowlist не гниёт сам: гейт красный, если запись матчит роут, который **уже**
импортирует контракты (запись пора убрать), или матчит **несуществующий** путь.
На волне 3: 40/119 роутов `/api/v1` на контрактах, 79 — в allowlist (27 записей).

---

## 7. Что контракты НЕ описывают

| Не описывается | Почему |
|---|---|
| SSE-потоки (`realtime/stream`, `jam/stream`, `playlists/stream`) | Поток событий, не запрос-ответ. Схема события — да, форма ответа — нет |
| Server Actions | Внутренний механизм Next, клиентам недоступен |
| `/admin` | Backoffice, единственный потребитель — веб. Осознанный статус-кво |
| Вебхуки провайдеров | Форму задаёт провайдер (YooKassa), не мы |

---

## 8. CORS

Сегодня не настроен вообще — веб на другом домене невозможен. Для нативных клиентов CORS
не нужен (это браузерный механизм), поэтому волна 4 его не требует.

Настраивается в момент, когда появится веб-клиент на другом origin — с закрытым списком
источников, не `*`, и никогда с `Access-Control-Allow-Credentials` при широком списке.
