# План: read-path каталога артистов (шаг 2.4)

**Спека:** `docs/superpowers/specs/2026-08-11-read-path-artist-catalog.md` ·
**Эталон:** шаг 2.3 (каталог релизов), коммит `95642400` — повторять его структуру файлов.

---

## Срез A — тип, порт, сервис, реализация (Sonnet)

**core:**
- `types/artist-card.ts` — `ArtistCard` (форма `ArtistListItem` из
  `packages/db/src/queries/artists.ts`: id, slug, name, bio, avatarUrl, firstReleaseCoverUrl,
  verified, releaseCount, genres).
- `repositories/artist-catalog.ts` — `ArtistCatalogQuery = { query: string | null; limit: number; offset: number }`,
  порт `IArtistCatalogRepository { list(params): Promise<ArtistCard[]> }`.
- `services/artist-catalog.ts` — `ArtistCatalogService.list(input)`: `query` тримится, пустая
  строка → `null`; `limit` клампится 1…200 (дефолт 200), `offset` 0…10000; запрос `limit + 1`,
  ответ `{ items, hasMore }` с срезанным хвостом.
- Тест `artist-catalog.test.ts`: дефолты, клампы, тримминг запроса, `limit + 1` в порт,
  `hasMore` на границе.

**db:**
- `listActiveArtists` (`queries/artists.ts`) получает `limit`/`offset` (сигнатура — объект,
  существующие вызовы с одним строковым аргументом сохранить работающими или обновить их
  все разом) и второй ключ сортировки `artistProfiles.id` после `lower(name)`.
- `repositories/artist-catalog.ts` — `DrizzleArtistCatalogRepository`, тонкая обёртка.
  Экспорт из `packages/db/src/index.ts`.
- `ArtistListItem` становится алиасом `ArtistCard` из `@vire/core` (как `DiscoveryRelease` в 2.3).

**Гейты:** typecheck core/db, test core, `check:layers`.

---

## Срез B — два входа и контракт (Sonnet)

- `packages/api-contracts/src/catalog.ts` — `artistCardSchema`.
- `packages/api-contracts/src/artist-catalog.ts` — `artistCatalogQuerySchema`
  (`query` строка ≤ 100, `limit` 1…60, `offset` 0…10000, всё опционально, coerce из query)
  и `artistCatalogResponseSchema` (`{ items, hasMore }`).
- `apps/web/app/api/v1/artists/route.ts` — `GET`, парс query схемой (400 на невалидном),
  сервис, маппинг в контракт. Директорию `[slug]/` не трогать.
- `apps/web/app/[locale]/(listener)/artists/(catalog)/page.tsx` — чтение через сервис
  (limit 200), разметка и клиентский фильтр не меняются.
- Тесты роута: 200 + парс контрактом, дефолты, проброс `query`/`limit`/`offset`,
  400 на `limit=0`/`limit=61`/`offset=10001`, `hasMore` на границе.

**Гейты:** typecheck/lint/test web, `check:routes`, `check:i18n`, build
(`NODE_OPTIONS=--dns-result-order=ipv4first` из `apps/web`).

---

## После срезов

Отметки 2.4 ✅ в `docs/migration-plan.md`, `docs/roadmap/platform-core-brief.md`,
`docs/api-contracts.md`.
