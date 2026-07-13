# 1-E: домен «волна / поиск / презейвы» → core — дизайн

Кусок 1-E из нарезки §1 (`2026-07-12-stage2-refactor-slicing-design.md`).
Рефакторинг **поведение 1:1**: оркестрация из хендлеров — в сервисы core,
эффекты (Redis-сессия, БД, время) — за портами. SQL-скоринг волны остаётся в
`packages/db/src/queries/wave.ts` (это repository-слой), материализация профиля
вкуса (§7.1) и воркеры фулфилмента — вне скоупа (уже за пределами HTTP).

## Скоуп — 4 route-файла

| Роут | Методы | Что уходит в сервис |
|---|---|---|
| `api/v1/wave` | GET | оркестрация: сессия/seed, исключения, key-match, taste, appendServed |
| `api/v1/search` | GET | тонкая обёртка searchAll |
| `api/v1/releases/[releaseId]/presave` | GET, POST, DELETE | правило «SCHEDULED и дата в будущем», user/guest ветки |
| `api/v1/presave/unsubscribe` | GET | удаление pending-презейвов гостя |

На краю (в хендлерах) остаётся: auth, все rate-limit'ы (3 штуки в presave POST),
валидация mood/genre по `ALL_MOODS`/`ALL_TRACK_GENRES`, валидация guest-email,
HMAC-проверка unsubscribe-токена (`lib/presave-unsubscribe.ts`), редирект
`/presave/unsubscribed?status=…`. Формы ответов и тексты ошибок — байт-в-байт.

## Порты

```ts
// repositories/wave.ts
export interface IWaveTrackSource {
  getWaveTracks(params: WaveParams): Promise<WaveTrack[]>;
  getTrackMusicalKey(trackId: string): Promise<string | null>;
  getArtistIdsForTracks(trackIds: string[]): Promise<string[]>;
  getTasteProfile(userId: string): Promise<TasteProfile>;
}
export interface IWaveSessionStore {
  get(sessionId: string): Promise<WaveSession>;      // деградация → пустая сессия
  appendServed(sessionId: string, trackIds: string[]): Promise<void>;
  setSeed(sessionId: string, seed: { mood?: string; genre?: string }): Promise<void>;
}

// repositories/presave.ts
export interface IPresaveRepository {
  getReleaseInfo(releaseId: string): Promise<{ id: string; status: string; releaseDate: Date | null } | null>;
  presaveForUser(userId: string, releaseId: string): Promise<void>;
  unpresaveForUser(userId: string, releaseId: string): Promise<void>;
  presaveForGuest(email: string, releaseId: string): Promise<void>;
  getState(userId: string, releaseId: string): Promise<boolean>;
  deletePendingGuestByEmail(email: string): Promise<number>;
}

// repositories/search.ts
export interface ISearchRepository { searchAll(query: string, limit: number): Promise<SearchResults>; }
```

Типы `WaveParams`, `WaveTrack`, `TasteProfile`, `WaveSession`, `SearchResults`
объявляются в core (источник правды), db-слой их реэкспортит — как в 1-D.
Если какие-то из этих типов сейчас в db завязаны на Drizzle-инференс — в core
объявить структурный эквивалент 1:1 и переключить db на него.

Адаптеры web: `lib/wave-session.ts` уже реализует IWaveSessionStore по форме
(обернуть/переименовать методы тонким объектом-адаптером, не менять Redis-логику
и деградацию); IWaveTrackSource / IPresaveRepository / ISearchRepository —
тонкие Drizzle-делегаты в `packages/db/src/repositories/`.

## Сервисы

### WaveService (новый, services/wave.ts)
`constructor(source: IWaveTrackSource, sessions: IWaveSessionStore)`
- `next(input: { sessionId, userId: string | null, mood: Mood-строка | null, genre: строка | null, currentTrackId: string | null })` → `Result<{ tracks: WaveTrack[] }>`
- Внутрь переезжает вся оркестрация текущего хендлера 1:1: чтение сессии,
  закрепление seed при первом запросе (setSeed), приоритет seed из сессии над
  query-параметрами (как сейчас), сбор исключений (последние 300 served),
  recentArtistIds (последние 5), `keyMatchSets` (уже core), taste profile только
  для залогиненного, вызов `getWaveTracks`, `appendServed` при непустом ответе.
- Redis-деградация сохраняется: стор возвращает пустую сессию/молча глотает —
  сервис не падает (это поведение адаптера, не сервиса).

### SearchService (новый, services/search.ts)
`constructor(repo: ISearchRepository)`
- `search(q: string, limit: number)` → `Result<SearchResults>`; правило «q короче
  2 символов → пустой результат» — в сервисе (сейчас на краю; перенос безопасен,
  ответ тот же). Роут (limit=4) и SSR-страница `/search` (limit=20) оба переходят
  на сервис — один код-путь, без дублей.

### PresaveService (новый, services/presave.ts)
`constructor(repo: IPresaveRepository, deps?: { now?: () => number })`
- `getState(userId, releaseId)` → `Result<{ presaved: boolean }>`.
- `presaveUser(userId, releaseId)` / `presaveGuest(email, releaseId)` →
  `Result<void, NotFoundError | ValidationError>`: релиз существует (иначе
  NotFound), правило «status === 'SCHEDULED' && releaseDate > now()» (иначе
  ValidationError с текущим текстом ошибки) — время через инъекцию `now`.
- `unpresave(userId, releaseId)` → `Result<void>` (1:1: без проверки существования, если так сейчас).
- `unsubscribeGuest(email)` → `Result<{ deleted: number }>` — вызов после
  HMAC-проверки на краю.
- Нормализация guest-email (lowercase/trim) — где она сейчас (query-слой) там и
  остаётся, не дублировать в сервисе.

## Тесты

- Core: WaveService — seed закрепляется один раз и выигрывает у query-параметров;
  исключения/recentArtists передаются в source; taste только для userId;
  appendServed не зовётся при пустом ответе; аноним. SearchService — короткий q.
  PresaveService — NotFound, не-SCHEDULED, дата в прошлом (через инъекцию now),
  guest/user ветки, unsubscribe счётчик.
- Web: существующие route.test.ts wave/presave/unsubscribe переводятся на моки
  портов/сервисных зависимостей (паттерн C2/D2); для `api/v1/search` тестов нет —
  добавить (короткий q → пустой, happy-path форма ответа, rate-limit 429).

## Исполнение

- **E1** — код целиком (core + db-делегаты + web-адаптеры/роуты/SSR-страница +
  тесты) одним Sonnet-агентом: кусок M-размера, разрыв core/web как в 1-D не
  оправдан. Гейты: все (typecheck×3, lint, check:routes, тесты core/db/web, build).
- **E2** — доки (architecture.md, stage-2 §1.1, TECHNICAL_DEBT при находках,
  CLAUDE.md счётчики, отклонения — сюда).
- Затем независимая самокритика (Sonnet) по контракту 1:1 и чистоте core.

## Отклонения при реализации (приняты)

1. `WaveNextInput` содержит также `playedIds: string[]` и `limit: number` — в спеке
   был сокращённый сниппет; поведение роута не меняется (`playedIds` ≤100 парсит
   хендлер, `count` — из zod-схемы).
2. Presave POST: порядок проверок нормализован — auth → rate-limit → release-check
   (раньше существование релиза проверялось до лимитов). Наблюдаемо только при
   одновременном rate-limit И несуществующем/непресейвабельном релизе: 429 вместо
   404/400. Та же семья нормализаций, что в 1-C/1-D.
3. Снят route-тест «Redis бросает → волна деградирует»: защитные `.catch()` в
   хендлере удалены как мёртвые — деградация целиком живёт в
   `apps/web/lib/wave-session.ts` (try/catch внутри каждой операции), адаптер
   `lib/wave-session-store.ts` тонкий, контракт порта `IWaveSessionStore` —
   «никогда не бросает».
4. db-тип `TasteProfile` НЕ переведён на core-тип: db-версия сужает поля до
   `Mood[]`/`TrackGenre[]` и используется в editorial/discovery/скоринге вне
   скоупа 1-E; core-версия — структурный эквивалент на `string[]`, ковариантно
   совместима.

По итогам самокритики уточнена сигнатура `presaveErrorResponse` в presave-роуте
(`NotFoundError | ValidationError` вместо `| Error`) — типизация, не поведение.
