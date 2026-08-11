# План: read-path каталога релизов (шаг 2.3)

**Спека:** `docs/superpowers/specs/2026-08-11-read-path-release-catalog.md` · Срезы последовательные.

---

## Срез A — тип, порт, сервис, реализация (Sonnet)

**core:**
- `packages/core/src/music/catalog/types/release-card.ts` — `ReleaseCard` (форма
  `DiscoveryRelease` из `packages/db/src/queries/discovery.ts`). В
  `types/artist-page.ts` `ArtistUpcomingRelease` становится алиасом `ReleaseCard`,
  дублирующее объявление уходит; публичные экспорты не меняются.
- `packages/core/src/music/catalog/repositories/release-catalog.ts` — порт
  `IReleaseCatalogRepository { list(params: ReleaseCatalogQuery): Promise<ReleaseCard[]> }`,
  `ReleaseCatalogQuery = { sort: ReleaseSort; sinceDays: number | null; limit: number; offset: number }`,
  `ReleaseSort = 'fresh' | 'popular'`.
- `packages/core/src/music/catalog/services/release-catalog.ts` — `ReleaseCatalogService.list(input)`:
  клампит `limit` (1…60, дефолт 60), `offset` (≥0), `sinceDays` (null или ≥1), дефолт `sort = 'fresh'`;
  просит у порта `limit + 1`; отдаёт `{ items, hasMore }` (лишняя запись срезается).
- Тест `release-catalog.test.ts`: клампы, дефолты, `hasMore` true/false на границе,
  передача параметров в порт ровно один раз, срезание хвостовой записи.

**db:**
- `listReleases` (`queries/discovery.ts`) получает `offset = 0` — `.offset(offset)` в обе ветки
  (fresh и popular). Больше SQL не трогать.
- `packages/db/src/repositories/release-catalog.ts` — `DrizzleReleaseCatalogRepository`,
  тонкая обёртка над `listReleases`. Экспорт из `packages/db/src/index.ts`.

**Гейты:** typecheck core/db, test core, `check:layers`.

---

## Срез B — два входа и контракт (Sonnet)

- `packages/api-contracts/src/catalog.ts` — `releaseCardSchema` (общая с `artist-page.ts`,
  где сейчас лежит `artistUpcomingReleaseSchema`; дубль убрать, публичный экспорт сохранить).
- `packages/api-contracts/src/release-catalog.ts` — `releaseCatalogQuerySchema`
  (`sort`, `sinceDays`, `limit`, `offset`; coerce из строк query, границы как в сервисе) и
  `releaseCatalogResponseSchema` (`{ items: ReleaseCard[]; hasMore: boolean }`, даты ISO).
- `apps/web/app/api/v1/releases/route.ts` — `GET`: парс query схемой (400 на невалидном),
  сервис на `DrizzleReleaseCatalogRepository`, маппинг в контракт. Роут публичный, сессия не нужна.
  Соседний `[releaseId]/` не трогать.
- `apps/web/app/[locale]/(listener)/releases/page.tsx` — вкладка → параметры остаются на странице,
  но чтение идёт через сервис (`ReleaseCatalogService`), не через `listReleases` напрямую.
  Разметка, счётчик и прогрессивный показ не меняются.
- Тесты роута: 200 + парс `releaseCatalogResponseSchema`, 400 на `sort=bogus` и `limit=0`,
  `hasMore` при выдаче ровно на границе, дефолты при пустом query.

**Гейты:** typecheck/lint/test web, `check:routes`, `check:i18n`, build
(`NODE_OPTIONS=--dns-result-order=ipv4first` из `apps/web` — иначе флакует next/font).

---

## После срезов

Отметка 2.3 ✅ в `docs/migration-plan.md`, журнал фаз в `docs/roadmap/platform-core-brief.md`,
строка ресурса в `docs/api-contracts.md`.
