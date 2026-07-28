# План: шардинг sitemap

Дизайн: `../specs/2026-07-28-sitemap-sharding-design.md`.

## Task 1 — запросы `packages/db/src/queries/sitemap.ts`

Новый файл. Пять пар «счётчик + страница», все со стабильным `ORDER BY` и
`limit`/`offset`. Никакого `select()` целиком — только нужные колонки.

Предикат видимого артиста переиспользуй существующий из `queries/artists.ts`
(`artistHasPublishedTrack` + `is_active`); если он не экспортирован — вынеси в
`sitemap.ts` копию **одним** `sql`-фрагментом и используй в обоих местах через экспорт,
не дублируй текст запроса в пяти местах.

```ts
export interface SitemapArtistRow { slug: string }
export interface SitemapReleaseRow { id: string; artistSlug: string; updatedAt: Date }
export interface SitemapTrackRow { id: string; releaseId: string; artistSlug: string; updatedAt: Date }
export interface SitemapSmartLinkRow { slug: string; artistSlug: string }
// плейлисты — существующий SitemapPlaylist { id, updatedAt }

countSitemapArtists(): Promise<number>
listSitemapArtists(limit: number, offset: number): Promise<SitemapArtistRow[]>
// … то же для releases / tracks / smartLinks / playlists
```

Правила выборки (дизайн, раздел «Что попадает в выдачу»):

- artists: `artist_profiles` где `is_active` и `exists (трек в PUBLISHED-релизе)`;
  `order by id`.
- releases: join `releases` × `artist_profiles`, артист видим, релиз —
  `status='PUBLISHED' or (status='SCHEDULED' and release_date is not null and release_date <= now())`.
  ⚠️ дату считай в SQL (`now()`), JS-`Date` в raw-`sql` Drizzle роняет postgres.js.
  `updatedAt` = `releases.updated_at`; `order by releases.id`.
- tracks: join `tracks` × `releases` × `artist_profiles` с тем же предикатом релиза;
  `updatedAt` берётся у релиза (как в текущем sitemap); `order by tracks.id`.
- smartLinks: join `smart_links` × `artist_profiles`, `is_published`, артист видим;
  `order by smart_links.id`.
- playlists: те же условия, что в `getSitemapPlaylists` (`PUBLIC`, `kind='USER'`,
  существует запись в `playlist_tracks`); `order by playlists.id`.

Экспортировать из `packages/db/src/index.ts`. Старые `listActiveArtists`/
`getSitemapPlaylists`/`listTrackIdsByReleaseIds` **не трогать** — ими пользуются другие
поверхности (`listTrackIdsByReleaseIds` после этой задачи останется без потребителей —
удали её и её экспорт, если grep подтвердит, что вызовов больше нет).

## Task 2 — чистая логика шардов `apps/web/lib/sitemap.ts`

TDD: сначала `apps/web/lib/__tests__/sitemap.test.ts`.

```ts
export const SITEMAP_PAGE_SIZE = 10_000;
export type SitemapSection = 'static' | 'artists' | 'releases' | 'tracks' | 'smartlinks' | 'playlists';
export interface ShardId { section: SitemapSection; page: number }

/** Список шардов по количеству записей в каждой секции. static — всегда, ровно один. */
export function planShards(counts: Record<Exclude<SitemapSection, 'static'>, number>, pageSize?: number): ShardId[]

/** 'artists-3.xml' → { section:'artists', page:3 }; 'static.xml' → { section:'static', page:0 }; мусор → null */
export function parseShardId(raw: string): ShardId | null

/** Обратно: { section:'artists', page:3 } → 'artists-3.xml' */
export function shardFileName(shard: ShardId): string
```

Кейсы: 0 записей в секции → шардов этой секции нет; ровно `pageSize` → один шард;
`pageSize+1` → два; `static` присутствует всегда; `parseShardId` отбивает `../`,
`artists-.xml`, `artists-01.xml` (ведущие нули), отрицательные, нечисловые,
неизвестную секцию; round-trip `parseShardId(shardFileName(x)) === x`.

## Task 3 — сериализация XML `apps/web/lib/sitemap-xml.ts`

Тоже чистая + тесты. `MetadataRoute.Sitemap` больше не используется (это не metadata-route),
поэтому свой минимальный тип и свой рендер:

```ts
export interface SitemapUrl { url: string; lastModified?: Date; changeFrequency?: string; priority?: number }
export function renderUrlSet(urls: SitemapUrl[]): string
export function renderSitemapIndex(entries: { url: string; lastModified?: Date }[]): string
```

Обязательно: XML-декларация, правильный namespace, `lastModified` в ISO,
экранирование `& < > " '` в URL. Тест на экранирование — обязателен, даже если сегодня
все slug'и латинские: это защита, а не косметика.

## Task 4 — роут индекса `apps/web/app/sitemap.xml/route.ts`

Удалить `apps/web/app/sitemap.ts`. Новый route handler:

- `export const dynamic = 'force-dynamic'` (причина та же, что была у `sitemap.ts`);
- пять `count`-запросов параллельно → `planShards` → `renderSitemapIndex`
  с абсолютными URL `${SITE_URL}/sitemaps/{file}`;
- `Content-Type: application/xml`;
- ошибка БД → индекс только со `static.xml` (никаких 5xx).

## Task 5 — роут шарда `apps/web/app/sitemaps/[shard]/route.ts`

- `parseShardId(params.shard)`; `null` → 404;
- `static` → четыре текущих маршрута (`/`, `/artists`, `/releases`, `/about`) с теми же
  `changeFrequency`/`priority`;
- остальные секции → соответствующий `list…(SITEMAP_PAGE_SIZE, page * SITEMAP_PAGE_SIZE)`,
  URL строятся ровно как сейчас в `sitemap.ts` (включая `lastModified`, `changeFrequency`,
  `priority` — сверься с текущим файлом построчно перед удалением);
- страница за пределами данных → пустой `<urlset>` (200, не 404);
- ошибка БД → пустой `<urlset>`.

## Task 6 — тесты роутов

`apps/web/app/sitemap.xml/route.test.ts` и `apps/web/app/sitemaps/[shard]/route.test.ts`
по образцу существующих route-тестов (моки `@vire/db` через `vi.mock`, см. любой
`app/api/**/route.test.ts`). Кейсы: состав индекса при разных счётчиках; деградация при
throw из БД; 404 на мусорном шарде; корректные URL релиза/трека/смартлинка; пустой шард.

## Task 7 — доки

- `docs/roadmap/TODO.md` — пункт «Sitemap без потолка» в `[x]` с одной строкой сути.
- `docs/features/seo.md` — секция про sitemap: индекс + шарды, потолок 10k, почему не
  `generateSitemaps`.
- `robots.ts` не трогать: он уже указывает на `/sitemap.xml`.

## Гейты

`pnpm --filter @vire/db typecheck`, `@vire/web typecheck`, `lint`, `check:routes`,
`test`, `build`. UI не трогается — `audit:design` не нужен.
