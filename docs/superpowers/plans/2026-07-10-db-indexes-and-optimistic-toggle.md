# План: индексы БД + useOptimisticToggle/api-client

Спека: `docs/superpowers/specs/2026-07-10-db-indexes-and-optimistic-toggle.md`.
Пачки независимы → реализуются параллельно, коммитятся раздельно.

---

## Пачка 1 — индексы (`@vire/db`)

### Ш1. Схема

`packages/db/src/schema/analytics.ts` — в колбэке индексов `playEvents`:

```ts
// было: index('play_events_track_id_idx').on(t.trackId)
index('play_events_track_started_idx').on(t.trackId, t.startedAt),
index('play_events_started_at_idx').on(t.startedAt),
index('play_events_user_id_idx').on(t.userId),
```

`packages/db/src/schema/artists.ts` (`artistProfiles`) и
`packages/db/src/schema/releases.ts` (`releases`, `tracks`) — добавить GIN:

```ts
import { sql } from 'drizzle-orm';
index('artist_profiles_name_trgm_idx').using('gin', sql`${t.name} gin_trgm_ops`),
index('releases_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
index('tracks_title_trgm_idx').using('gin', sql`${t.title} gin_trgm_ops`),
```

Стиль индексов в проекте — колбэк `(t) => [...]` (drizzle-orm 0.45.2). Сохранить.

### Ш2. Миграция

`pnpm --filter @vire/db db:generate` → новый `0032_*.sql`.
**Вручную** дописать первой строкой файла:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

(без него `gin_trgm_ops` не существует и `CREATE INDEX` падает).

Проверить, что drizzle сгенерировал `DROP INDEX "play_events_track_id_idx";` —
если нет, дописать.

### Ш3. Проверки

1. `pnpm --filter @vire/db db:migrate` на локальной БД — применяется.
2. `pnpm --filter @vire/db db:generate` ещё раз → **«No schema changes»**.
   Если drizzle-kit снова предлагает пересоздать GIN-индексы — снапшот их не
   переваривает: убрать из схемы, оставить чистый SQL в миграции, а в схеме
   поставить комментарий-ссылку на миграцию. Это фолбэк, не первый выбор.
3. `psql \d play_events` и `\d artist_profiles` — индексы на месте.

### Ш4. Замер (отдельная БД, локальные данные не трогать)

Скрипт — во временный каталог сессии, **не коммитить**.

1. `CREATE DATABASE vire_bench;` в контейнере `vire-postgres`.
2. Прогнать миграции на `vire_bench` (`DATABASE_URL` override).
3. Засеять синтетику: ~50 артистов, ~300 релизов, ~1500 треков, **≥200 000
   `play_events`** с реалистичным разбросом `started_at` за 60 дней; треки
   должны иметь `track_moods`/`track_genres`, иначе `getWaveTracks` вернёт пусто.
4. `ANALYZE;`
5. Замер **до**: индексы пока старые (композита нет — миграция 0032 его создала…
   значит на bench-БД сначала откатить руками: `DROP INDEX play_events_track_started_idx;
   CREATE INDEX play_events_track_id_idx ON play_events(track_id);` и
   `DROP INDEX` трёх GIN). Так «до» = сегодняшний прод.
6. Для каждой из двух конфигураций собрать:
   - `EXPLAIN (ANALYZE, BUFFERS)` коррелированного подзапроса популярности;
   - `EXPLAIN (ANALYZE, BUFFERS)` `ILIKE '%…%'` по трём таблицам;
   - тайминг `getWaveTracks(...)` — 10 прогонов, медиана;
   - тайминг `search(...)` — 10 прогонов, медиана.
7. `DROP DATABASE vire_bench;`

### Ш5. Вердикт

В `docs/roadmap/TODO.md` обновить пункт про волновой скоринг: цифрами показать,
остался ли он узким местом. Если да — оставить в бэклоге с замером; если нет —
закрыть с пометкой «снято индексом».

---

## Пачка 2 — toggle (`@vire/api-contracts`, `@vire/api-client`, `apps/web`)

### Ш1. Контракты

Новый `packages/api-contracts/src/toggle.ts`:

```ts
export const followResponseSchema  = z.object({ following: z.boolean() });
export const likeResponseSchema    = z.object({ liked: z.boolean() });
export const presaveResponseSchema = z.object({ presaved: z.boolean(), guest: z.boolean().optional() });
```

`src/index.ts` — добавить `export * from './toggle';`.

### Ш2. `@vire/api-client`

Структура (зеркалит `packages/api-contracts`):

```
packages/api-client/
  package.json      name @vire/api-client, private, type module,
                    exports "." -> ./src/index.ts,
                    deps: zod, @vire/api-contracts (workspace:*)
                    devDeps: vitest, typescript, @vire/config
                    scripts: test, typecheck
  vitest.config.ts  (по образцу packages/core)
  tsconfig.json     (по образцу packages/api-contracts)
  src/
    result.ts       ApiResult<T>, ApiError { status: number; message: string }
                    status = 0 для сетевого сбоя
    http.ts         request<T>(url, { method, schema, body? }): Promise<ApiResult<T>>
    toggles.ts      followArtist(slug, next), likeTrack(id, next),
                    likePlaylist(id, next), presaveRelease(id, next),
                    presaveReleaseAsGuest(id, email)
    index.ts
```

`request()` — контракт:
- `fetch` бросил (offline/CORS) → `{ok:false, error:{status:0, message:'Нет соединения'}}`
- `!res.ok` → попытаться прочитать `{error}` из тела; `message` = серверный текст
  либо дефолт; `status` = HTTP-код
- `res.ok`, но JSON не парсится или не проходит `schema.safeParse` →
  `{ok:false, error:{status:res.status, message:'Неверный ответ сервера'}}`
- иначе `{ok:true, data}`

Никаких `throw` наружу.

Подключить пакет в `apps/web/package.json` (`"@vire/api-client": "workspace:*"`) →
`pnpm install` из корня.

### Ш3. Хук

Новый `apps/web/lib/use-optimistic-toggle.ts` (`'use client'`):

```ts
export function useOptimisticToggle({ initial, initialCount = 0, request, errorMessage }): {
  on: boolean; count: number; pending: boolean; toggle: () => void;
}
```

- guard: `if (pending) return;`
- оптимистично: `setOn(next)`, `setCount(c => c + (next ? 1 : -1))`
- `const res = await request(next)`
- `if (!res.ok)`: откат обоих + `toast.error(errorMessage ?? 'Не удалось сохранить. Попробуй ещё раз')`
- `finally { setPending(false) }`

Тост берётся из `@/components/toast` (кастомный, zustand — **не sonner**).

### Ш4. Перевод пяти мест

| Файл | Что делаем |
|---|---|
| `app/(listener)/artists/[slug]/follow-button.tsx` | хук + `followArtist`; `errorMessage: 'Не удалось обновить подписку'`; `useTransition` убрать, `disabled={pending}` оставить |
| `app/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/like-button.tsx` | хук + `likeTrack`; `'Не удалось сохранить лайк'` |
| `components/use-playlist-like.ts` | хук + `likePlaylist`; **добавляется** тост `'Не удалось сохранить лайк'`; публичная сигнатура `{liked, likes, pending, toggle}` сохраняется (иначе поедут вызывающие) |
| `components/upcoming-presave-button.tsx` | хук + `presaveRelease`; без счётчика |
| `components/presave-button.tsx` | **только** `toggleUser` → хук + `presaveRelease`. `submitGuest` остаётся, но `fetch` → `presaveReleaseAsGuest`, серверный текст ошибки берётся из `error.message` |

### Ш5. Тесты

- `packages/api-client/src/__tests__/http.test.ts` — 4 ветки контракта `request()`
  (`vi.stubGlobal('fetch', …)`).
- `packages/api-client/src/__tests__/toggles.test.ts` — методы/URL по `next`.
- `apps/web/lib/__tests__/use-optimistic-toggle.test.tsx` — `renderHook` из
  `@testing-library/react` (в web уже есть, как и jsdom): оптимистичный флип,
  откат + тост при `ok:false`, guard двойного клика (request вызван один раз).

### Ш6. Документация

`docs/features/api-client.md` по шаблону `docs/features/README.md`: что делает,
где код, почему охват узкий, как добавлять новый эндпоинт.

---

## Гейты (общие, Iron Law — вывод в сообщении)

```
pnpm --filter @vire/web typecheck
pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes
pnpm --filter @vire/web test
pnpm --filter @vire/api-client test
pnpm --filter @vire/core test
pnpm --filter @vire/db test
pnpm --filter @vire/web audit:design
pnpm --filter @vire/web build
```

## Порядок коммитов

1. `perf(db): композитный индекс play_events + триграммный поиск`
2. `refactor(web): общий useOptimisticToggle поверх @vire/api-client`
3. `docs: фича api-client, вердикт по волновому скорингу в TODO`
