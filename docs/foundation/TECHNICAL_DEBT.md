# Technical Debt — Vire Этап 1

Архитектурные компромиссы, принятые ради скорости выхода. Каждый пункт — осознанный shortcut, не случайная ошибка.

---

## Аутентификация и сессии

### JWT без перечитывания БД
Роль, имя и аватар пользователя кладутся в JWT при логине (`jwt`-callback в `auth.ts`). Стратегия `jwt` не обращается к БД на каждый запрос — после смены роли (`db:make-admin`, верификация в `/admin/users`) или правки профиля пользователь **должен перелогиниться**.

**Последствие:** между сменой роли и перелогином — рассинхрон данных. Исправление: `session`-стратегия с БД или принудительная инвалидация сессии через Redis.

### `createArtistForUser` повышает только LISTENER
При создании артиста через `/admin/users` роль меняется `LISTENER → ARTIST`, но `MODERATOR`/`ADMIN`/`SUPERADMIN` не понижается. Сделано после инцидента, когда создание артиста на email суперадмина отобрало доступ к админке.

---

## Безопасность

### `'unsafe-inline'` в CSP
CSP содержит `script-src 'unsafe-inline'`, что ослабляет защиту от XSS. Убрать без nonces нельзя: Next.js 15/16 инжектирует инлайн-скрипты гидрации/RSC-стриминга без nonce-атрибутов из коробки.

**Исследовано и отложено с находками (10.07.2026).** Nonce-путь был реализован полностью (per-request nonce в `proxy.ts` middleware, `buildCsp(nonce)` в отдельном модуле) и **сознательно откачен**. Три причины:

1. **Сырые инлайн-скрипты не получают nonce.** Next автоматически проставляет `nonce=` только на *свои* инлайн-скрипты (читает nonce из CSP заголовка запроса через `getScriptNonceFromHeader`). Наш `<script dangerouslySetInnerHTML>` reduce-motion в `app/layout.tsx:100` — не next-script, nonce ему не достаётся → в проде без `'unsafe-inline'` он **блокируется** браузером (анимации мигнут у выбравших приглушение). Dev это маскирует: там `'unsafe-inline'` остаётся (nonce в dev не подмешан намеренно). Каждый будущий инлайн-скрипт пришлось бы вручную протягивать nonce из `headers()` — постоянный источник тихих проком-багов.
2. **Nonce ⇒ dynamic rendering всей площадки.** Per-request nonce нельзя вычислить статически → Next выводит страницы из статики/ISR в динамику. Это регрессия LCP публичных SEO-страниц (артисты/релизы/треки), которые как раз держатся на статике. В пассе стабилизации — недопустимо.
3. **Hash-only не спасает.** Хэш сработал бы для статичного reduce-motion скрипта, но инлайн RSC-стриминг Next (`self.__next_f.push(...)`) несёт per-request данные → его хэш не фиксируется. Значит для фреймворковых скриптов всё равно нужен либо `'unsafe-inline'`, либо nonce.

**Возврат** — отдельной задачей вне стабильной версии: либо (a) убрать сырой инлайн-скрипт reduce-motion (перевести на next/script с nonce или на CSS-only pre-paint), затем nonce + принять dynamic rendering там, где нет статики; либо (b) дождаться нативной поддержки nonce для статики в Next.

---

## Надёжность воркера

### ✅ Retry / exponential backoff — закрыто
Все очереди BullMQ (`apps/web/lib/queue.ts`) настроены с `attempts` + `backoff: { type: 'exponential', ... }`. DLQ и email/push артисту при перманентном сбое транскодинга — не сделаны, остаются открытым хвостом.

---

## Observability

### Нет структурированных логов с request_id
API-роуты логируют через `console.error` без контекста запроса. При инциденте нельзя скоррелировать ошибки одного запроса. Нужны: JSON-логи, `request_id` в middleware, Sentry для трейсинга.

---

## Модель данных

### ✅ Один владелец артиста — закрыто
Таблица `artist_members` с ролями (owner / collaborator / manager) реализована (`packages/db/src/schema/artists.ts`, `queries/artists.ts`, `repositories/artist.ts`) — несколько аккаунтов на артиста работают, см. `docs/features/multi-artist.md`.

### ✅ `play_events` — прямые инсерты — закрыто
Запись идёт через BullMQ-очередь (`QUEUE_PLAY_EVENTS`, продюсер `apps/web/lib/queue.ts`) и воркер `apps/worker/src/workers/play-events.worker.ts`, который вызывает `insertPlayEvent` — не прямым инсертом из хендлера.

---

## Сервисный слой — интерактивы слушателя (1-C)

### `getPlaylistSuggestions` и `position=max+1` — в query-слое
`PlaylistService.suggestions`/`addTrack` (`packages/core`) делегируют use-case и
атомарную вставку query-функциям `@vire/db` вместо переноса логики в сервис —
атомарность транзакции и цельность read-use-case дороже слойности. Перенос в core —
когда понадобится переиспользование вне HTTP-слоя.

### Асимметрии поведения интерактивов
Сохранены 1:1 при выносе в core (`docs/superpowers/specs/2026-07-12-listener-interactions-core-design.md`), кандидаты на отдельный продуктовый фикс:
- `DELETE /api/v1/tracks/[id]/like` не проверяет существование трека (`ListenerTrackService.unlike`)
- rate-limit стоит на `DELETE /api/v1/playlists/[id]/like`, на `DELETE /api/v1/tracks/[id]/like` — нет
- `PlaylistService.like`/`unlike` не проверяют существование плейлиста

### `addTrackErrorText` различает ошибки по тексту сообщения
`apps/web/app/api/v1/playlists/[id]/tracks/route.ts` выбирает текст 404 по
`error.message.startsWith('Track')` — сломается молча при смене формата сообщения.
Фикс: структурное поле `resource` в `NotFoundError` (`packages/core/src/errors.ts`).

### `DrizzlePlaylistRepository.create` синтезирует поля `PlaylistSummary`
`packages/db/src/repositories/playlist.ts` возвращает выдуманные `visibility`/`trackCount`/даты,
хотя потребителю нужен только `id`. Фикс: сузить возврат порта до `{ id: string }`
или возвращать реальную вставленную строку.

---

## Сервисный слой — дашборд артиста (1-D)

### Тонкие роуты остались нетронутыми
`genres`, `analyze`, `analyze-genre`, `genre-suggestions`, `audio-features`, `live`,
`active-artist` — вне скоупа 1-D (обёртки над query/очередью/cookie, не бизнес-логика).
✅ Тесты `live` и `tracks/[id]/genres` — закрыты срезом 1-H. Перенос в core сам по
себе остаётся открытым (1-H вышел тестовым срезом, не рефакторингом) — кандидат
на будущий заход.

### FormData-парсинг остаётся ручным, без zod
Осознанно (см. спеку) — переписывание на zod-схемы это churn без функциональной пользы
в рамках чистого рефакторинга; тексты и коды ошибок сохраняются 1:1.

---

## Server actions (1-F)

### 11 тонких admin-actions и signIn/cookie-флоу остались на краю
Осознанно (см. спеку `docs/superpowers/specs/2026-07-13-server-actions-core-design.md`):
RBAC-гейт + один вызов query-функции + `revalidatePath` — хостить в core нечего.
Кандидаты на пересмотр — только если в них заведётся логика.

### Пробел покрытия, скрывший MAJOR самокритики, — закрыт
Комбинация «несколько невалидных полей одновременно» (порядок валидаций в
`TrackService.adminUpdate`) не была покрыта тестом — самокритика нашла регресс
порядка проверок (`lyrics` раньше `title`) уже после мерджа. Закрыто тестом
«reports the title error first…» в `b7f9d1c`.

### Нормализация порядка проверок
Сохранены не 1:1 (5 отклонений, безопасны — расширяют, не сужают, набор кодов ответа):
парсинг тела до ownership в PATCH постов/смартлинков, S3-загрузка трека после ownership,
краевая валидация (title/type/genre/image/status) в хендлерах releases и smart-links
теперь ДО сервисной ownership-проверки. Полный список и обоснование —
`docs/superpowers/specs/2026-07-12-dashboard-core-design.md`, раздел «Отклонения при
реализации (приняты)».

---

## Тесты остатка API-роутов (1-H)

### `PATCH /api/v1/user/profile` — имя из пробелов проходит валидацию
Zod валидирует имя ДО `.trim()` (`min(1)` проверяется на сырой строке) — имя из
одних пробелов проходит `min(1)` и сохраняется в БД пустой строкой. Найдено
тестовым срезом 1-H. Фикс — `.trim()` до `min(1)` + регресс-тест, отдельным
коммитом вне среза.

### Конвенция: admin-роуты (`backfill-analysis`/`editorial`/`system`) отвечают 403, не 401
В `requireAdmin`/roleGuard нет отдельной 401-ветки для анонима — и аноним, и
авторизованный не-админ получают 403 'Forbidden'. Осознанно, не баг: подтверждено
тестами 1-H (`docs/superpowers/specs/2026-07-13-route-tests-remainder-design.md`).

---

## Этап 2 (продажи) — отложено намеренно

Purchase-UI (`download-button.tsx`, `purchased-track-row.tsx`) отвязан от витрины. API-роуты (`purchase`, `webhooks/yookassa`) сохранены, YooKassa не настроена в боевом режиме. Подключать только по команде.

---

## Что НЕ является долгом

- Отсутствие `Permissions-Policy` для `autoplay` — аудиоплеер использует `HTMLAudioElement`, не Web Audio API, политика не применяется
- `alt=""` на декоративных изображениях — правильное поведение по WCAG
- `import type` вместо `import` в большинстве файлов — корректная практика TS
