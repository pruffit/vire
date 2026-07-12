# 1-C: домен «интерактивы слушателя» → core

> Кусок 1-C из нарезки §1 (`2026-07-12-stage2-refactor-slicing-design.md`).
> Рефакторинг, поведение API — 1:1. Инвентаризация домена — 12.07.2026.

## Цель

Вынести бизнес-логику 13 роутов (follow, like трека, плейлисты ×7, моменты, mood-теги,
lyrics GET) в `packages/core` как сервисы с портами и `Result`, роуты превратить в тонкие
HTTP-адаптеры по канону `dashboard/releases/[id]` DELETE. Тесты растут вместе с выносом.

## Скоуп

Роуты `apps/web/app/api/v1/...`:
- `artists/[slug]/follow` (POST/DELETE)
- `tracks/[id]/like` (GET/POST/DELETE), `tracks/[id]/moments` (GET/POST),
  `tracks/[id]/moods` (GET/PUT), `tracks/[id]/lyrics` (GET)
- `playlists` (GET/POST), `playlists/[id]` (GET/PATCH/DELETE),
  `playlists/[id]/tracks` (PUT/POST), `playlists/[id]/tracks/[trackId]` (DELETE),
  `playlists/[id]/like` (GET/POST/DELETE), `playlists/[id]/cover` (POST),
  `playlists/[id]/add-search` (GET), `playlists/[id]/suggestions` (GET)

Вне скоупа: запись lyrics (PATCH dashboard/tracks — кусок 1-D), editorial/personal
плейлисты (`queries/editorial.ts` и их query-функции), SSR-страницы (продолжают звать
query-функции напрямую — read-модели, не мутации), `api-client` (контракт JSON не меняется).

## Инварианты (поведение 1:1 — сохранять в точности)

- Формы ответов: `{ following }`, `{ liked }`, `{ moods }`, `{ lyrics }`, статусы и тексты
  ошибок как сейчас (`api-client/toggles.ts` зависит от форм).
- Асимметрии сохраняем как есть (НЕ чинить в этом куске): DELETE like без `trackExists`;
  rate-limit на DELETE playlist-like есть, на DELETE track-like нет; playlist-like не
  проверяет существование плейлиста; порядок проверок PUT (валидация→владение) vs
  POST (владение→валидация) в `playlists/[id]/tracks`.
- DELETE плейлиста: 404 и при «не найден», и при «не владелец» (boolean из repo) — как сейчас.
- Reorder: 403 при чужом плейлисте, 409 при permutation-конфликте.
- Rate-limit, auth-guard, парсинг FormData/query/body, zod-валидация — остаются в роуте
  (HTTP-слой). Cache-Control для lyrics — в роуте.
- Анонимный POST момента разрешён (rate-limit по clientKey — в роуте).

## Сервисы и порты (packages/core)

Ошибки: существующий `NotFoundError`; добавить `ConflictError` (тот же стиль, `_tag`)
для reorder-409. Прочие отказы владения — `err(new Error('Forbidden: ...'))`, роут маппит
`NotFoundError→404, ConflictError→409, иначе→403` (канон домена).

Общий хелпер (вынести из приватного `TrackService.authorizeTrack`, сам TrackService
переключить на него — внутренний рефактор без смены поведения):

```ts
// core/src/services/authorize-track.ts
export async function authorizeTrackOwnership(
  trackRepo: ITrackRepository, releaseRepo: IReleaseRepository,
  trackId: string, artistProfileId: string,
): Promise<Result<Track, NotFoundError | Error>>
```

### FollowService

```ts
interface IFollowRepository {
  follow(userId: string, artistProfileId: string): Promise<void>;
  unfollow(userId: string, artistProfileId: string): Promise<void>;
}
class FollowService {
  constructor(artistRepo: IArtistRepository, followRepo: IFollowRepository) {}
  follow(userId: string, artistSlug: string): Promise<Result<void, NotFoundError | Error>>;
  unfollow(userId: string, artistSlug: string): Promise<Result<void, NotFoundError | Error>>;
}
```

Резолв slug→artist внутри сервиса (`findBySlug` → `NotFoundError`).

### ListenerTrackService (лайки, моменты, lyrics — публичные интерактивы трека)

```ts
interface IListenerTrackRepository {
  trackExists(trackId: string): Promise<boolean>;
  getLikeState(userId: string, trackId: string): Promise<boolean>;
  like(userId: string, trackId: string): Promise<void>;
  unlike(userId: string, trackId: string): Promise<void>;
  getAggregateMoments(trackId: string): Promise<AggregateMoment[]>;
  addMoment(trackId: string, positionSec: number, userId: string | null): Promise<void>;
  getPublicLyrics(trackId: string): Promise<string | null>; // правило PUBLISHED-only остаётся в реализации (visibility-фильтр запроса)
}
class ListenerTrackService {
  constructor(repo: IListenerTrackRepository) {}
  getLikeState(userId, trackId): Promise<Result<boolean, Error>>;
  like(userId, trackId): Promise<Result<void, NotFoundError | Error>>;   // exists → NotFound
  unlike(userId, trackId): Promise<Result<void, Error>>;                 // без exists (1:1)
  getMoments(trackId): Promise<Result<AggregateMoment[], NotFoundError | Error>>;
  addMoment(trackId, positionSec, userId | null): Promise<Result<void, NotFoundError | Error>>;
  getPublicLyrics(trackId): Promise<Result<string | null, Error>>;
}
```

`AggregateMoment` — доменный тип по текущей форме ответа `getAggregateMoments`.

### TrackMoodsService

```ts
interface ITrackMoodsRepository {
  get(trackId: string): Promise<Mood[]>;
  set(trackId: string, moods: Mood[]): Promise<void>;
}
class TrackMoodsService {
  constructor(trackRepo: ITrackRepository, releaseRepo: IReleaseRepository, moodsRepo: ITrackMoodsRepository) {}
  getMoods(trackId): Promise<Result<Mood[], NotFoundError | Error>>;      // exists через trackRepo.findById
  setMoods(trackId, artistProfileId, moods: Mood[]): Promise<Result<void, NotFoundError | Error>>; // authorizeTrackOwnership
}
```

Источник правды для `Mood` — enum в `@vire/db`, а core не импортирует db. Решение:
сервис принимает `readonly string[]` (валидация enum остаётся в zod роута — внешний вход),
доменный инвариант «≤5 тегов» — правило сервиса. Порт `ITrackMoodsRepository` в core
типизирован строками; Drizzle-реализация сужает до `Mood[]` у себя.

### PlaylistService

```ts
interface IPlaylistRepository {
  listByUser(userId): Promise<PlaylistSummary[]>;
  trackMembership(userId, trackId): Promise<string[]>;          // getTrackPlaylistIds
  create(userId, title): Promise<PlaylistSummary>;
  getWithTracks(id): Promise<PlaylistWithTracks | null>;
  update(id, userId, patch): Promise<void>;
  delete(id, userId): Promise<boolean>;                          // владение в WHERE (1:1)
  addTrack(playlistId, trackId, userId): Promise<void>;          // position=max+1 остаётся в транзакции репо
  removeTrack(playlistId, trackId): Promise<void>;
  reorder(playlistId, userId, trackIds): Promise<boolean>;       // permutation-проверка в транзакции (1:1)
  setCover(playlistId, userId, coverUrl: string | null): Promise<void>;
  searchTracks(q, excludeIds, limit): Promise<TrackSearchResult[]>;
  suggestions(playlistId, userId): Promise<PlaylistSuggestions>; // use-case остаётся в query (осознанный долг, см. ниже)
  getLikeState(userId, playlistId): Promise<boolean>;
  like(userId, playlistId): Promise<void>;
  unlike(userId, playlistId): Promise<void>;
  trackExists(trackId): Promise<boolean>;
}
interface IPlaylistCoverStorage {
  upload(key: string, body: Buffer, contentType: string): Promise<string>; // → публичный URL
}
class PlaylistService {
  constructor(repo: IPlaylistRepository, storage: IPlaylistCoverStorage, now: () => number) {}
  listForUser(userId, trackId?): Result<{playlists, inPlaylists?}>        // ветвление по trackId — сюда
  create(userId, title): Result<PlaylistSummary>
  getForViewer(id, viewerUserId | null): Result<PlaylistWithTracks, NotFoundError | Error> // PRIVATE+не владелец → Forbidden
  update(id, userId, patch): Result<void, NotFoundError | Error>          // trim/normalize патча — сюда
  delete(id, userId): Result<void, NotFoundError>                         // false → NotFound (1:1)
  addTrack(id, userId, trackId): Result<void, NotFoundError | Error>      // владение + trackExists
  removeTrack(id, userId, trackId): Result<void, NotFoundError | Error>
  reorder(id, userId, trackIds): Result<void, NotFoundError | ConflictError | Error>
  setCover(id, userId, file: {buffer, contentType, ext} | null): Result<string | null, ...>
      // владение → null: repo.setCover(null); файл: storage.upload → `?v=${now()}` → repo.setCover
  searchForAdding(id, userId, q): Result<TrackSearchResult[], ...>        // q.trim().length<2 → [] (правило в сервисе)
  suggestions(id, userId): Result<PlaylistSuggestions, ...>
  getLikeState(userId, id) / like(userId, id) / unlike(userId, id)        // без exists-проверки (1:1)
}
```

Парсинг multipart и `validateImageUpload` (magic bytes, политика) — остаются в роуте
(валидация входа = HTTP-слой). Сервису передаётся уже провалидированный буфер.

## Реализации портов (packages/db/src/repositories)

`DrizzleFollowRepository`, `DrizzleListenerTrackRepository`, `DrizzleTrackMoodsRepository`,
`DrizzlePlaylistRepository` — тонкие делегаты в существующие query-функции (кроме маппинга
доменных типов). Query-функции НЕ удалять и не менять сигнатуры: у них есть внешние
потребители (SSR-страницы, listener-data.ts, admin actions). Адаптер S3 для
`IPlaylistCoverStorage` — в `apps/web` (обёртка над `uploadToStream`), как queue-адаптер.

## Осознанный долг (зафиксировать, не чинить здесь)

- `getPlaylistSuggestions` и position=max+1 в `addTrackToPlaylist` — остаются в query-слое
  (атомарность/цельный read-use-case); сервис добавляет только владение.
- Асимметрии поведения из «Инвариантов» — кандидаты на отдельный продуктовый фикс.
- `packages/db`: `ALL_MOODS`/`ALL_TRACK_GENRES` можно экспортировать без аннотации
  `: Mood[]`, тогда tuple-тип `enumValues` уберёт касты в zod (`z.enum(ALL_MOODS)`) — придирка
  ревью 1-A, можно закрыть попутно в этом куске.

## Тесты

- core: юнит-тесты всех 4 сервисов по паттерну `__tests__/services/track.test.ts`
  (фабрики репо с `vi.fn()`, ok/err-ветки, NotFound/Conflict, «репо не вызван при early-return»;
  reorder — missing/extra/dupes; getForViewer — матрица PRIVATE×владелец).
- web: route.test.ts для непокрытых роутов — moments, moods, lyrics,
  `playlists/[id]/tracks/[trackId]` DELETE, `playlists` POST, `playlists/[id]/tracks` POST,
  `playlists/[id]` GET, `tracks/[id]/like` GET. Существующие route-тесты — страховка 1:1,
  правятся только моки (`@vire/db` → мок сервисных зависимостей по месту).

## Порядок реализации (сабагенты, последовательно)

1. **C1**: core (errors ConflictError, authorize-track хелпер + рефактор TrackService,
   4 сервиса + порты + юнит-тесты) + Drizzle-адаптеры + экспорт из index — гейты core+db.
2. **C2**: переключение 13 роутов + правка/добавление route-тестов + S3-адаптер — гейты web полные.
3. **C3**: докфайл `docs/features/` не нужен (не фича) — обновить `docs/foundation/architecture.md`
   (карта сервисов), stage-2 §1 разметку, TECHNICAL_DEBT (осознанный долг выше).
