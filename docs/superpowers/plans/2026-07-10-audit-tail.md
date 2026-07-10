# План: хвост аудита (10.07.2026)

Спека: `docs/superpowers/specs/2026-07-10-audit-tail.md`.

## Оркестрация
Главная сессия (Opus) — оркестратор. Реализация — Sonnet-сабагентами по пачкам.
Пачки трогают непересекающиеся файлы → безопасно параллелить B и D (чистый фронт /
чистые пакеты). A и C трогают `packages/db` + миграции / роуты — их ведём аккуратно.

**Общий ресурс — .next и БД.** Сабагенты НЕ гоняют `pnpm build`/dev на общем `.next`
(память: build+dev на одном .next → 404-подвох) и НЕ создают две миграции параллельно
(конфликт номера `0033`). Только A1 создаёт миграцию. Финальные web-гейты
(typecheck/lint/test/build) гоняет главная сессия ОДИН раз после слияния всех пачек.
Сабагенты гоняют только узкие проверки своих пакетов (vitest пакета, tsc пакета).

## Пачка A (Sonnet, sequential — миграция + замер)
1. A1: индекс в схему `packages/db/src/schema/analytics.ts`
   (`play_events(track_id, started_at) INCLUDE (duration_played_sec)`), `db:generate`
   → миграция `0033`. Замер харнессом (сид синтетики → EXPLAIN ANALYZE + медиана 10
   прогонов `getWaveTracks` до/после). Вердикт в TODO. Top-N — только если мало.
2. A2: рефактор `listArtistsAdmin` — агрегатные подзапросы одним проходом; сверить
   числа на локальной БД. Юнит по возможности.

## Пачка B (Sonnet, параллельно с D)
B1 store guard + likeTrack; B2 sitemap batch; B3 XHR abort; B4 a11y (2 файла);
B5 плеер resume-кадр. Тесты: расширить существующие, где есть; store/likes — guard.
Узкие проверки: `pnpm --filter @vire/web test` по затронутым файлам.

## Пачка C (Sonnet, после A — общий packages/db не трогает, но роуты)
C1 IP-лимит + отписка (роут + воркер + шаблон письма + токен отписки); C2 HMAC
sessionId (env-секрет, деградация); C3 CSP nonce — В ПОСЛЕДНЮЮ ОЧЕРЕДЬ, с рантайм-
проверкой. Если nonce ломает виджеты — откат + запись в TECHNICAL_DEBT.

## Пачка D (Sonnet, параллельно с B)
D1 `typecheck` скрипты в `packages/core` и `packages/db` package.json + в
`.github/workflows/deploy.yml` job gates + в CLAUDE.md команды. D2 single-flight
в `createTtlCache` (Map in-flight промисов, тест на дедупликацию).

## Верификация (главная сессия, в конце)
```
pnpm --filter @vire/core typecheck   # новый
pnpm --filter @vire/db typecheck     # новый
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
pnpm --filter @vire/db test
```
Независимый критик (Sonnet, свежий контекст) по Vire-чеклисту до «готово».

## Ship
Атомарные коммиты по пачкам. Доки: `docs/features/*` где новое поведение
(отписка пресейва, presence-подпись, CSP nonce), отметки `[x]` в TODO.
Версия/тег — НЕ трогаем (по команде пользователя).
