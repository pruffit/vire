# §1 — рефакторинг: карта фактов и нарезка на куски

> Stage-2 §1. Это НЕ спека одной задачи — это результат инвентаризации (12.07.2026)
> и порядок кусков; каждый кусок идёт отдельным циклом spec→plan→impl.

## Карта фактов (инвентаризация)

- **Слои:** из 58 route-файлов канон (Service+Result) целиком — 2 (`releases/[releaseId]`,
  `artists/[slug]`); частично — 4; ~40 зовут query-функции `@vire/db` напрямую; в core
  всего 3 сервиса (Artist/Release/Track), остальная логика — 31 файл `packages/db/queries/*`
  + инлайн в хендлерах. Самые тяжёлые инлайны: `dashboard/profile` (135 строк),
  `dashboard/smart-links/[id]` (21 if), `wave` (106 строк), `dashboard/releases` (create),
  `releases/[id]/status` (очередь в хендлере), `purchase`/`webhooks/yookassa`.
- **Server actions:** все 3 файла (`admin/actions.ts` — ~20 прямых db-импортов,
  `sign-in/auth-actions.ts`, `profile/account-actions.ts`) ходят в БД напрямую.
- **packages/core чист** (0 импортов Next/Drizzle, 0 голых Date/random/fetch, Result
  везде) — проблема не в качестве core, а в его малом покрытии.
- **`any`:** фактически 2 места (moods/genres route — осознанные eslint-disable на
  рассинхроне zod↔сигнатура). НЕ источник долга; §1.4 почти закрыт до старта.
- **FSD не внедрён вовсе** (нет слоёв features/entities/shared); реальные нарушения
  направления: 4 импорта `lib/* → components/*` + 1 `components/* → app/*`.
- **Крупные файлы:** ui-kit.tsx 671, artists/[slug]/page.tsx 661, design/page 630,
  genres.ts 591, audio-engine.ts 568.
- **Тесты:** 22/58 роутов без route.test.ts; в packages/db тесты у 3 из 31 query-файлов;
  repositories без прямых тестов.
- **TECHNICAL_DEBT.md частично протух:** «один владелец артиста» закрыт (artist_members),
  «нет retry/backoff» закрыт (attempts+exponential в lib/queue.ts), «play_events прямым
  инсертом» закрыт (BullMQ-буфер с ceed2dc; insertPlayEvent зовётся из воркера).
  Живое: JWT без перечитывания, CSP 'unsafe-inline' (осознанно отложено), структурные логи.

## Решения

1. **Полный FSD НЕ внедряем.** Структуры нет, миграция дорогая, ценность для соло-разработки
   спорная. Фиксируем «FSD-lite»: направление импортов `app → components → lib` (lib не
   импортирует из components/app; components не импортирует из app), группировка по фиче
   внутри `components/*` по мере касания. stage-2 §1.3 переформулировать под это.
2. **Сервисный слой наращиваем доменами, не файлами.** Не «пройти 40 роутов», а вынести
   домен целиком (сервис + порт + Result), роуты домена переключить разом.
3. **§1.4 (any) считаем закрытым** после ликвидации 2 осознанных кастов (типизировать
   setTrackMoods/setTrackGenres от zod-выхода).
4. Покрытие тестами растим вместе с выносом домена (сервис получает юнит-тесты в core,
   роут — route.test.ts), а не отдельным «этапом тестов».

## Нарезка (порядок = приоритет)

| Кусок | Что | Размер |
|---|---|---|
| **1-A. Гигиена доков и мелочей** | актуализировать TECHNICAL_DEBT.md по фактам выше; убить 2 `as any`; переформулировать §1.3/§1.4 в stage-2 | S |
| **1-B. FSD-lite: направление импортов** | развернуть 5 нарушений (toast/audio-engine/linked-accounts): вынести источники вниз (toast-API в lib, геттеры audio-engine в lib/player) без смены поведения | S |
| **1-C. Домен «интерактивы слушателя» → core** | follow, like, playlists (все роуты), moments, moods, lyrics: сервисы+порты+Result, роуты переключить, тесты | L |
| **1-D. Домен «дашборд артиста» → core** | releases create/PATCH/status (очередь за интерфейс), posts, smart-links, profile (S3 за интерфейс), upload-оркестрация | L |
| **1-E. Домен «волна/поиск/презейвы» → core** | wave/route.ts (сессия/seed — в сервис), search, presave | M |
| **1-F. Server actions → core** | admin/actions.ts (20 импортов), auth-actions, account-actions | M |
| **1-G. Распил крупных файлов** | ui-kit.tsx, artists/[slug]/page.tsx, audio-engine.ts — по мере касания в 1-C/1-D, не отдельным заходом | M |
| **1-H. Тесты остатка** | роуты вне доменов выше (health, admin/system, feedback, listening-now, search) | M |
| **1-I. Бандл/перфоманс** | ревизия зависимостей, динамические импорты, LCP-проход | M |
| **1-J. Платёжка → core + тесты** | purchase/webhook: сервис + route-тесты. **Этап 2 — только по команде Danya** | M |

1-A и 1-B — быстрые, можно первым же заходом. 1-C — первый большой кусок (даёт
паттерн для 1-D/1-E/1-F). 1-J заморожен до команды.

## Вне скоупа §1

- Дизайн-работа (§2), новые фичи, изменение поведения API (рефакторинг — поведение
  1:1, страховка — существующие route-тесты и добавляемые новые).
