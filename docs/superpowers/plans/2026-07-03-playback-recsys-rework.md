# План: переработка воспроизведения и рекомендаций

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать спеку `docs/superpowers/specs/2026-07-03-playback-recsys-rework-design.md` — Волна v2 (пачки, серверный анти-повтор, нормализованные сигналы, персональный seed, жанры), переработка ядра плеера (очередь/шаффл/персист/контекст/перф), единый профиль вкуса, ранжирование подборок, защита manifest, редизайн UI плеера и Потока.

**Architecture:** Слои по CLAUDE.md: route (apps/web/app/api) → чистая логика (packages/core) → SQL (packages/db). Плеер: Zustand-store (persist) ← императивный audio-engine ← единый вход `usePlay`. Анти-повтор волны — Redis (`apps/web/lib`, деградация к клиентскому списку).

**Tech Stack:** Next.js 15, TypeScript strict, Zustand (+persist), hls.js, Drizzle, ioredis, zod (api-contracts), Vitest.

## Global Constraints

- Никаких `min-h-screen`/`h-screen` на страницах/лейаутах (app-shell).
- Никаких `any` без причины-коммента; типы из zod-схем.
- Не интерполировать JS-Date и колонки в raw-`sql` Drizzle (даты — `now() - interval`, внешние таблицы — литералом).
- Ошибки как значения, все внешние входы — через zod.
- Комментарии — минимум, только неочевидное «почему».
- Перед новым UI — искать готовое в `packages/ui` и `apps/web/components`.
- Мобильная вёрстка проверяется для каждого UI-изменения.
- После каждой задачи: `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test` зелёные; коммит.
- Существующие тесты (200) не ломать; поведение вне скоупа не менять.

---

## Фаза A — контракты, чистые сигналы, сервер волны

### Task A1: zod-контракты волны и источников воспроизведения

**Files:**
- Create: `packages/api-contracts/src/wave.ts`
- Modify: `packages/api-contracts/src/index.ts` (экспорт)

**Interfaces (Produces):**
```ts
// packages/api-contracts/src/wave.ts
import { z } from 'zod';

export const PLAY_SOURCES = ['wave','release','playlist','artist','home','feed','search','liked','purchased','direct'] as const;
export const playSourceSchema = z.enum(PLAY_SOURCES);
export type PlaySource = z.infer<typeof playSourceSchema>;

export const waveTrackSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  artistName: z.string(),
  artistSlug: z.string(),
  releaseId: z.string().uuid(),
  coverUrl: z.string().nullable(),
  accentColor: z.string().nullable(),
  isExplicit: z.boolean(),
});
export type WaveTrackDTO = z.infer<typeof waveTrackSchema>;

export const waveQuerySchema = z.object({
  sessionId: z.string().min(8).max(64).optional(),
  trackId: z.string().uuid().optional(),
  mood: z.string().optional(),      // валидируется по ALL_MOODS на роуте
  genre: z.string().optional(),     // валидируется по ALL_TRACK_GENRES на роуте
  played: z.string().optional(),    // csv uuid, ≤100 после парсинга
  count: z.coerce.number().int().min(1).max(5).default(3),
});

export const waveResponseSchema = z.object({ tracks: z.array(waveTrackSchema) });
export type WaveResponse = z.infer<typeof waveResponseSchema>;
```

**Steps:**
- [ ] Посмотреть структуру `packages/api-contracts/src` и повторить её паттерн экспорта.
- [ ] Создать `wave.ts` с кодом выше, экспортировать из `index.ts`.
- [ ] `pnpm --filter @vire/api-contracts typecheck` (или build — как принято в пакете) → зелёный.
- [ ] Commit: `feat(contracts): zod-схемы волны и источников воспроизведения`.

### Task A2: тональности — парсер и Camelot-совместимость (packages/core)

**Files:**
- Create: `packages/core/src/services/musical-key.ts`
- Create: `packages/core/src/services/musical-key.test.ts` (рядом, по паттерну пакета)
- Modify: `packages/core/src/index.ts` (экспорт)

**Interfaces (Produces):**
```ts
export interface ParsedKey { pitchClass: number; mode: 'major' | 'minor' } // pitchClass 0..11, C=0
export function parseMusicalKey(raw: string | null | undefined): ParsedKey | null;
/** Все нормализованные написания заданной тональности: 'am','amin','aminor','a-moll','8a', 'ля минор' НЕ нужен (YAGNI) */
export function keySpellings(key: ParsedKey): string[];
/** Родственные тональности: относительная (Am↔C) и соседи ±1 по кругу квинт того же лада */
export function neighborKeys(key: ParsedKey): ParsedKey[];
/** Наборы нормализованных строк для SQL-матчинга кандидатов */
export function keyMatchSets(raw: string | null | undefined): { exact: string[]; neighbor: string[] } | null;
/** Нормализация свободного ввода: lower, убрать пробелы/дефисы, ♯→#, ♭→b */
export function normalizeKeyString(raw: string): string;
```

Парсер принимает: `Am`, `A min`, `A minor`, `a-moll`, `F#m`, `Gbm` (энгармонизм → один pitchClass), `C`, `C major`, `C dur`, Camelot `8A`/`8B` (A=minor, B=major). Не распарсилось → null.

**Steps (TDD):**
- [ ] Написать падающие тесты: таблица кейсов parse (`'Am'→{9,'minor'}`, `'8A'→{9,'minor'}`, `'C'→{0,'major'}`, `'F#m'→{6,'minor'}`, `'Gb'→{6,'major'}`, `'x'→null`, `''→null`, `null→null`); `neighborKeys({9,minor})` = относительная `{0,major}` + `{2,minor}` (9+5)%12? — см. ниже; `keyMatchSets('Am').exact` содержит `'am'`,`'aminor'`,`'8a'`; neighbor содержит написания C-мажора и E/D-миноров по кругу.
  Круг квинт для минора: соседи = pitchClass±7 (mod 12) того же лада; относительная для минора = pitchClass+3 (mod 12) major, для мажора = pitchClass−3 (mod 12) minor.
- [ ] Прогнать — FAIL. Реализовать. Прогнать — PASS (`pnpm --filter @vire/core test`).
- [ ] Commit: `feat(core): парсер тональностей и Camelot-совместимость для волны`.

### Task A3: профиль вкуса и счётчики жанров (packages/db)

**Files:**
- Create: `packages/db/src/queries/taste.ts`
- Modify: `packages/db/src/queries/track-genres.ts` (добавить `getGenreCounts`)
- Modify: `packages/db/src/index.ts` (экспорты)

**Interfaces (Produces):**
```ts
// taste.ts
export interface TasteProfile { topMoods: Mood[]; topGenres: TrackGenre[]; topArtistIds: string[] }
/** Лайки ∪ прослушивания за 90 дней; топ-5 每 категории. Пусто = нет сигнала. */
export async function getTasteProfile(userId: string): Promise<TasteProfile>;
// track-genres.ts
export async function getGenreCounts(): Promise<{ genre: TrackGenre; count: number }[]>; // только READY-треки вышедших релизов активных артистов, count>0
```

Реализация `getTasteProfile`: один CTE-запрос или 3 параллельных — mood/genre/artist по объединению `likes.track_id` и `play_events.track_id (user_id=…, started_at >= now() - interval '90 days')`, `GROUP BY … ORDER BY count(*) DESC LIMIT 5`. Даты только на стороне SQL. `getGenreCounts` — зеркало `getMoodCounts` из `track-moods.ts` (переиспользовать его SQL-условия видимости).

**Steps:**
- [ ] Изучить `getMoodCounts` в `packages/db/src/queries/track-moods.ts`, повторить условия видимости.
- [ ] Реализовать оба запроса, экспортировать. `pnpm --filter @vire/db typecheck` (или build) зелёный.
- [ ] Commit: `feat(db): единый профиль вкуса getTasteProfile + getGenreCounts`.

### Task A4: Волна v2 — SQL (packages/db)

**Files:**
- Modify: `packages/db/src/queries/wave.ts` (переписать)
- Modify: `packages/db/src/index.ts` (экспорт новой сигнатуры)

**Interfaces (Produces):**
```ts
export interface WaveParams {
  currentTrackId: string | null;
  excludeIds: string[];            // served (redis) + played (клиент) + current, ≤300
  limit: number;                   // 1..5
  seedMood: Mood | null;           // фильтр seed-режима
  seedGenre: TrackGenre | null;    // фильтр seed-режима
  sessionMood: Mood | null;        // мягкий буст всех треков сессии (+0.35 при совпадении)
  sessionGenre: TrackGenre | null; // мягкий буст (+0.35)
  taste: TasteProfile | null;      // null = аноним
  keySets: { exact: string[]; neighbor: string[] } | null; // от musical-key.ts (вычисляет роут)
  recentArtistIds: string[];       // артисты последних ~5 выданных; штраф −0.4
  userId: string | null;           // для fatiguePenalty
}
export async function getWaveTracks(p: WaveParams): Promise<WaveTrack[]>; // WaveTrack как раньше
```

Изменения против текущего `getWaveNextTrack`:
1. **Возвращает массив** (`limit` кандидатов по score DESC), не один трек.
2. **Seed-режим** (currentTrackId=null): не `ORDER BY random()`, а тот же скоринг-запрос без компонент похожести:
   - вошедший (`taste` непустой): `tasteMoodScore` + `tasteGenreScore` (доля совпадений с topGenres через track_genres, вес 0.4) + `qualityScore` + `random()*0.3`;
   - аноним: `ORDER BY ln(plays30 + 1) * random() DESC`, где `plays30` — коррелированный `COUNT` play_events за 30 дней (каталог мал, допустимо);
   - `seedMood`/`seedGenre` — жёсткие `EXISTS`-фильтры (genre: `track_genres` ИЛИ `releases.genre` при отсутствии строк в track_genres).
3. **keyScore**: вместо строкового равенства — `CASE WHEN lower(regexp_replace(track_audio.musical_key, '[\s-]', '', 'g')) = ANY(exact) THEN 0.5 WHEN … = ANY(neighbor) THEN 0.3 ELSE 0 END` (наборы приходят параметром; NULL-key → 0). Массивы передавать как параметры (`inArray`-стиль/`sql` c `ARRAY[…]::text[]` через параметризованные значения, НЕ raw-интерполяция пользовательских строк).
4. **Единый genreScore**: `track_genres` — доля совпавших (вес 0.4); фолбэк `releases.genre = current` (вес 0.3) применяется ТОЛЬКО если у кандидата нет строк в `track_genres` (CASE с NOT EXISTS). Старый двойной учёт убрать.
5. **tasteGenreScore** (вес 0.25) — аналог tasteMoodScore по `track_genres` из `taste.topGenres`.
6. **Штраф разнообразия**: `CASE WHEN artist_profiles.id = ANY(recentArtistIds) THEN -0.4 ELSE 0 END` (параметризованный uuid[]).
7. **Сессионный буст**: `sessionMood`/`sessionGenre` → `EXISTS`-совпадение = +0.35.
8. tasteMoodValues больше не вычисляется внутри (приходит из `taste`).
Остальные сигналы (mood, bpm, quality, moment, fatigue, шум 0.15) — без изменений.

**Steps:**
- [ ] Переписать `wave.ts` по интерфейсу выше; проверить, что все массивы в SQL параметризованы (никаких `sql.raw` с внешними данными; текущие `sql.raw` для mood/genre enum-ов заменить на параметризованные массивы).
- [ ] `pnpm --filter @vire/db typecheck` зелёный; `pnpm --filter @vire/web typecheck` пока красный (роут ещё на старой сигнатуре) — допустимо до A5, поэтому коммит совместно с A5 ИЛИ оставить старый экспорт-обёртку `getWaveNextTrack` (однострочный адаптер) и удалить его в A5. Выбрать адаптер — тогда typecheck зелёный.
- [ ] Commit: `feat(db): волна v2 — пачки, единый жанр, camelot-тональности, seed по вкусу, разнообразие артистов`.

### Task A5: Волна v2 — Redis-сессия и роут (apps/web)

**Files:**
- Create: `apps/web/lib/wave-session.ts`
- Modify: `apps/web/app/api/v1/wave/route.ts`
- Modify/Create tests: `apps/web/app/api/v1/wave/route.test.ts`
- Delete: адаптер `getWaveNextTrack` из A4.

**Interfaces (Produces):**
```ts
// wave-session.ts — деградация: любая ошибка Redis → пустые данные, не исключение
export async function getWaveSession(sessionId: string): Promise<{ servedIds: string[]; mood: string | null; genre: string | null }>;
export async function appendWaveServed(sessionId: string, trackIds: string[]): Promise<void>; // SADD + EXPIRE 6h
export async function setWaveSessionSeed(sessionId: string, seed: { mood?: string; genre?: string }): Promise<void>; // SET hash, EXPIRE 6h
```
Redis-клиент — по образцу `apps/web/lib/presence.ts` (ioredis, тот же REDIS_URL, тот же паттерн обработки недоступности). Ключи: `wave:served:{sessionId}` (SET), `wave:seed:{sessionId}` (HASH mood/genre).

Роут (сохранить `rateLimit(…, 120, 60)`):
1. Параметры — `waveQuerySchema` из `@vire/api-contracts`; mood/genre валидировать по `ALL_MOODS`/`ALL_TRACK_GENRES` (невалидные → 400).
2. `sessionId` нет → сгенерировать не надо: клиент всегда шлёт (см. B2); без sessionId работать stateless (served=[]).
3. Сбор `excludeIds` = served ∪ played(csv, ≤100) ∪ currentTrackId.
4. `recentArtistIds`: по последним 5 served-ids один запрос к db (join tracks→releases→artist_profile_id) — добавить хелпер `getArtistIdsForTracks(trackIds)` в `packages/db/src/queries/discovery.ts` или рядом с wave.
5. Вкус: `auth()` → userId → `getTasteProfile(userId)` (или null).
6. `keySets`: у seed-режима null; иначе прочитать `musicalKey` текущего трека (запрос уже был внутри старой волны — теперь роут берёт его через существующий экспорт db `getTrackAudio`-типа запрос либо новый маленький `getTrackWaveMeta(trackId)` в wave.ts: `{ bpm, musicalKey, moods, genres, releaseGenre }`, вычислить `keyMatchSets` из `@vire/core`).
   → Итог: `getWaveTracks` принимает ещё `currentMeta` (bpm/moods/genres/releaseGenre) вместо самостоятельных под-запросов? НЕТ — оставить под-запросы внутри `getWaveTracks` (меньше трогаем), наружу только `musicalKey`: добавить в A4 параметр `keySets`, а bpm/mood/genre текущего трека query получает сама, как сейчас. Для keySets роуту нужен только musicalKey текущего трека — новый экспорт `getTrackMusicalKey(trackId): Promise<string | null>` в `packages/db/src/queries/wave.ts`.
7. При первом запросе с mood/genre → `setWaveSessionSeed`; далее сессионные буст-параметры из `getWaveSession`.
8. После выборки: `appendWaveServed(sessionId, ids)`; ответ `{ tracks }` по `waveResponseSchema`.

**Тесты (route.test.ts, дополнить существующие):** невалидный mood → 400; невалидный genre → 400; count>5 → 400 (zod max) или кламп по схеме (`max(5)` → 400); happy path мокает db/redis-модули и проверяет, что `getWaveTracks` вызван с excludeIds, содержащими served+played, и что ответ — массив; отсутствие sessionId → served не запрашивается; Redis-модуль бросает → 200 всё равно (деградация).

**Steps:**
- [ ] Изучить текущий роут и `lib/presence.ts`; написать падающие тесты; реализовать `wave-session.ts` и роут; удалить адаптер.
- [ ] `pnpm --filter @vire/web typecheck && pnpm --filter @vire/web test` зелёные.
- [ ] Commit: `feat(api): волна v2 — пачки, redis-сессия анти-повтора, жанровый вход`.

### Task A6: защита manifest + rate-limit медиа-эндпоинтов

**Files:**
- Modify: `apps/web/app/api/v1/tracks/[id]/manifest/route.ts`
- Modify: `packages/db/src/queries/track-audio.ts` (или создать `getPlayableTrackAudio`)
- Modify: `apps/web/app/api/v1/tracks/[id]/play/route.ts` (VALID_SOURCES → PLAY_SOURCES из contracts + rate-limit)
- Modify: `apps/web/app/api/v1/tracks/[id]/listening/route.ts`, `apps/web/app/api/v1/presence/route.ts` (rate-limit)
- Tests: соответствующие `route.test.ts`

**Produces:** `getPlayableTrackAudio(trackId)` — как `getTrackAudio`, но с join: `tracks.status='READY'` AND (`releases.status='PUBLISHED'` OR SCHEDULED+дата прошла) AND `artist_profiles.is_active` — иначе null; отдельно возвращает `artistProfileId` для owner-проверки.

Роут manifest: публичный доступ только к playable; иначе — если `auth()` даёт юзера, который владелец артиста трека (существующий паттерн проверки владения искать в dashboard-роутах) или роль MODERATOR/ADMIN/SUPERADMIN — отдать по старому пути (`getTrackAudio`). Всё прочее → 404. Rate-limit по образцу wave: manifest 60/мин, play 40/мин, listening 12/мин, presence 12/мин (ключ — ip+session, как реализовано в существующей утилите).

**Тесты:** manifest: READY+published → 200; PROCESSING → 404 анониму; unpublished релиз → 404 анониму; владелец → 200; админ → 200. play: source 'wave' проходит валидацию; неизвестный source → 'direct'.

**Steps:**
- [ ] Изучить существующую rate-limit утилиту wave-роута и owner-проверки dashboard-роутов; написать падающие тесты; реализовать.
- [ ] Гейты web зелёные. Commit: `fix(api): manifest только для играбельных треков + rate-limit медиа-эндпоинтов`.

---

## Фаза B — ядро плеера

### Task B1: чистая логика очереди + новый стор с персистом

**Files:**
- Create: `apps/web/lib/player/queue.ts`
- Create: `apps/web/lib/player/queue.test.ts`
- Create: `apps/web/lib/session-id.ts` (перенос `getSessionId` из audio-engine; переиспользовать в site-presence)
- Modify: `apps/web/store/player.ts`
- Modify: `apps/web/components/site-presence.tsx` (импорт session-id)

**Interfaces (Produces):**
```ts
// lib/player/queue.ts — чистые функции, без Zustand
export function fisherYates<T>(arr: T[], rand?: () => number): T[];
/** ON: [current, ...перемешанный остаток]; возвращает новую очередь и index=0 */
export function shuffleOn(queue: PlayerTrack[], currentIndex: number, rand?: () => number): { queue: PlayerTrack[]; index: number };
/** OFF: восстановление original; index = позиция текущего трека в original */
export function shuffleOff(original: PlayerTrack[], currentId: string): { queue: PlayerTrack[]; index: number };
export function dedupeQueue(tracks: PlayerTrack[]): PlayerTrack[]; // по id, первый выигрывает

// store/player.ts
export type PlayContext = { source: PlaySource; sourceId?: string }; // PlaySource из @vire/api-contracts
interface State { // было + новое:
  context: PlayContext | null;
  originalQueue: PlayerTrack[] | null; // только при shuffle=true
  restored: boolean; // true после гидрации persist с треком (плеер стоит на паузе, манифест не грузился)
}
```
Persist: `zustand/middleware` `persist(..., { name: 'vire-player', version: 1, partialize })` — сохраняются `track, queue(срез ≤100), queueIndex, volume, waveMode, shuffle, context, originalQueue, currentTime`. `currentTime` пишется тиком раз в 5с из движка (B2). `onRehydrateStorage`: если есть track → `restored: true, isPlaying: false, hasAudio: false`. Невалидная версия → сброс (дефолт persist).

**Тесты queue.test.ts:** fisherYates — перестановка (длина/состав), детерминизм с подсунутым rand; shuffleOn — текущий первым, состав сохранён; shuffleOff — индекс указывает на текущий; dedupeQueue.

**Steps:**
- [ ] TDD queue.ts (FAIL→PASS). Обновить store (persist, новые поля), вынести session-id, обновить site-presence.
- [ ] `typecheck && test` зелёные (ломающиеся импорты `_setState`-паттерна чинятся в B2 — если что-то падает уже сейчас, минимально поправить импорты без смены поведения).
- [ ] Commit: `feat(player): честный шаффл, дедуп очереди, персист стора, единый session-id`.

### Task B2: audio-engine v2 — интенты, буфер волны, префетч, resume, source

**Files:**
- Modify: `apps/web/components/player/audio-engine.ts` (переписать)
- Create: `apps/web/lib/player/manifest-cache.ts` + `manifest-cache.test.ts`
- Create: `apps/web/lib/player/wave-buffer.ts` + `wave-buffer.test.ts`

**Interfaces (Produces):**
```ts
// manifest-cache.ts — LRU ≤10: trackId → { hlsUrl, waveformPeaks }
export function getCachedManifest(trackId: string): ManifestData | undefined;
export function putCachedManifest(trackId: string, data: ManifestData): void;
export async function fetchManifest(trackId: string): Promise<ManifestData | null>; // через кэш

// wave-buffer.ts — чистое решение «пора ли дозапрашивать»
export function needsWaveFetch(queueLen: number, queueIndex: number, waveMode: boolean, inFlight: boolean): boolean; // remaining ≤ 2
export async function fetchWaveTracks(params: { sessionId: string; trackId?: string; mood?: string; genre?: string; played: string[] }): Promise<PlayerTrack[]>; // GET /api/v1/wave, парс waveResponseSchema, маппинг в PlayerTrack (accentColor ?? undefined)

// audio-engine.ts — публичное API
export function initAudioEngine(): void;
export function getAudioTime(): number;             // для useAudioTime
export const controls = {
  playQueue(tracks: PlayerTrack[], opts: { startIndex?: number; context: PlayContext; shuffle?: boolean }): void,
  toggle(trackId?: string): void,                    // toggle-if-current
  togglePlay, seek, setVolume, toggleMute, next, prev,
  toggleShuffle(): void,                             // через shuffleOn/shuffleOff из B1
  startWave(seed: { mood?: string; genre?: string } | null): Promise<boolean>, // создаёт wave-сессию: sessionId = crypto.randomUUID() в store? — в module-level, персистится в sessionStorage 'vire_wave_sid'
  stopWave(): void,
  resumeRestored(): void,                            // первый play после гидрации: fetchManifest + seek(persisted currentTime)
};
```
Ключевые правила:
- `initAudioEngine` идемпотентен; `playQueue` до инициализации складывает интент и исполняет его после `init` (вызов init внутри playQueue — гонка исчезает).
- `ended` → `flushPlayEvent(context.source)` → `next()`. `next()` при wave-режиме берёт трек из уже дозагруженного буфера очереди (мгновенно); дозапрос буфера (`needsWaveFetch` → `fetchWaveTracks` → append в очередь с dedupe) запускается на `playing` и на `timeupdate`-триггере, не на `ended`.
- Префетч манифеста следующего трека при `duration - currentTime < 15` (один раз на трек).
- `flushPlayEvent(source)` — source из `store.context?.source ?? 'direct'`.
- Ошибка загрузки трека при waveMode → пропустить к следующему из буфера (максимум 3 подряд, затем audioError).
- Персист-тик: каждые 5с при isPlaying писать currentTime в стор (persist сам сохранит).
- `waveHistory` заменяется: played для запросов = id из очереди до текущего (срез ≤100) — история и так в очереди; анти-повтор основной — серверный.
- `startWave`: генерирует/читает `vire_wave_sid` (sessionStorage), `fetchWaveTracks({count:3})`, `playQueue(tracks, { context: { source:'wave' }, ... })`, `setWaveMode(true)`. Ошибка → false (UI покажет toast).

**Тесты:** manifest-cache (LRU-вытеснение, кэш-хит без fetch — мок fetch); wave-buffer.needsWaveFetch таблица; fetchWaveTracks — мок fetch, парс схемы, маппинг null accentColor → undefined. Движок целиком юнитами не покрывать (jsdom-аудио хрупок) — вся выносимая логика уже вынесена.

**Steps:**
- [ ] TDD для двух новых lib-модулей; переписать audio-engine на новое API, сохранив HLS-воркэраунды (`maxBufferHole`, bufferStalledError-скачок, watchdog, Safari-ветка) БЕЗ изменений.
- [ ] Временный экспорт-алиас `controls.play(track, queue, index)` → `playQueue` (депрекейт, удалить в B3) чтобы не сломать 18 точек до миграции.
- [ ] `typecheck && test` зелёные. Commit: `feat(player): движок v2 — буфер волны, префетч манифестов, resume, реальный source`.

### Task B3: единый вход воспроизведения и миграция всех точек запуска

**Files:**
- Create: `apps/web/lib/player/use-play.ts` (хук `usePlay` + `useLazyQueue`)
- Create: `apps/web/lib/player/to-player-track.ts` + `to-player-track.test.ts`
- Modify (все точки запуска): `components/home/cover-rail.tsx`, `components/listening-now.tsx`, `components/mood-wave-chips.tsx`, `components/wave-start-button.tsx`, `components/release-hero-play.tsx`, `app/(listener)/artists/[slug]/releases/[releaseId]/track-list.tsx`, `components/release-quick-look.tsx`, `components/featured-play-button.tsx`, `app/(listener)/artists/[slug]/artist-popular-tracks.tsx`, `app/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/waveform-player.tsx`, `.../track-lyrics.tsx`, `app/(listener)/playlists/[id]/playlist-view.tsx`, `.../playlist-track-row.tsx`, `components/playlist-quick-look.tsx`, `components/listener/liked-track-row.tsx`, `app/(listener)/profile/purchased-track-row.tsx`, `components/track-list.tsx`
- Modify: страницы-поставщики данных, где `accentColor` есть, но выбрасывается (страница релиза `releases/[releaseId]/page.tsx`, трек-страница, данные плейлиста) — прокинуть `accentColor`/`isExplicit` в маппинг.
- Modify: `packages/db/src/queries/playlists.ts` — добавить `isExplicit` (и `accentColor`, если его нет) в `PlaylistTrackRow`.
- Delete: депрекейт-алиас `controls.play` из B2.

**Interfaces (Produces):**
```ts
// use-play.ts
export function usePlay(): {
  playQueue: typeof controls.playQueue;
  toggle: (trackId: string) => void;
  isCurrent: (trackId: string) => boolean;
  isPlaying: boolean;
};
/** Ленивая загрузка треков релиза/плейлиста для quick-look и featured — один общий фетч+маппинг */
export function useLazyQueue(kind: 'release' | 'playlist', id: string): { load: () => Promise<PlayerTrack[] | null>; loading: boolean };

// to-player-track.ts — перегрузки-мапперы из серверных шейпов
export function toPlayerTrack(row: { id: string; title: string; artistName: string; coverUrl?: string | null; artistSlug?: string; releaseId?: string; accentColor?: string | null; isExplicit?: boolean | null }): PlayerTrack;
export function toPlayerTracks(rows: …[]): PlayerTrack[];
```
Каждая точка запуска передаёт свой `PlayContext` (`release`+releaseId, `playlist`+id, `home`, `artist`+slug, `liked`, `purchased`, `feed`, `wave`). «Перемешать» в `playlist-view.tsx` — `playQueue(tracks, { context, shuffle: true })`, локальный сорт-шаффл удалить. `wave-start-button.tsx`/`mood-wave-chips.tsx` — на `controls.startWave(...)` (общая логика, toast при false в обоих).

**Тесты:** to-player-track (null-нормализация, отсутствие опциональных); существующие тесты компонентов не ломать. Route-тесты не трогаются.

**Steps:**
- [ ] TDD маппера; создать хуки; мигрировать точки по списку (grep `controls.play(` до нуля вне engine); удалить алиас; прокинуть accentColor из страниц.
- [ ] `typecheck && lint && test` зелёные. Commit: `refactor(player): единый вход usePlay/playQueue, PlayContext и акцент из всех точек запуска`.

### Task B4: производительность — useAudioTime, единый waveform-скраббер, кэш LRC

**Files:**
- Create: `apps/web/lib/player/use-audio-time.ts`
- Create: `apps/web/components/player/waveform-scrubber.tsx`
- Modify: `apps/web/components/player/index.tsx` (использовать общий скраббер + useAudioTime; убрать подписки на store.currentTime из всех листьев)
- Modify: `apps/web/app/(listener)/artists/[slug]/releases/[releaseId]/tracks/[trackId]/waveform-player.tsx` (общий скраббер с маркерами моментов)
- Modify: `apps/web/components/player/audio-engine.ts` (timeupdate больше НЕ пишет currentTime в стор на каждый тик — только персист-тик 5с и смена трека/seek)
- Modify: `apps/web/components/player/lyrics.tsx`, `components/lyrics-scroll.tsx` (время из useAudioTime; кэш текста Map по trackId на модульном уровне; бинарный поиск активной строки не нужен — достаточно memo индекса от секунды)

**Interfaces (Produces):**
```ts
export function useAudioTime(fps?: number): number; // rAF-цикл (fps по умолчанию 4), локальный state, читает getAudioTime()
// waveform-scrubber.tsx
export function WaveformScrubber(props: {
  peaks: number[] | null; barCount?: number; markers?: { ratio: number; count: number }[];
  onSeek(time: number): void; duration: number; className?: string; ariaLabel?: string;
}): JSX.Element; // прогресс — overlay/clip по useAudioTime, бары — useMemo(peaks, barCount)
```

**Steps:**
- [ ] Реализовать хук и общий скраббер; мигрировать оба потребителя; выпилить дубли `ratioFromX/buildBars`; убрать store-подписки на currentTime (grep `state.currentTime`/`s.currentTime` по components — остаться должно только внутри persist/seek-логики).
- [ ] Ручная проверка: `pnpm --filter @vire/web dev` — прогресс идёт, скраб работает (плеер и трек-страница), LRC подсвечивается, нет двойного fetch lyrics (Network).
- [ ] `typecheck && lint && test && audit:design` зелёные. Commit: `perf(player): изоляция тиков времени, единый waveform-скраббер, кэш LRC`.

---

## Фаза C — рекомендации

### Task C1: ранжирование editorial + единый вкус в генерации

**Files:**
- Modify: `packages/db/src/queries/editorial.ts`
- Create: `packages/db/src/queries/popularity.ts` (`topTrackIdsByPlays(days, limit)` — общий билдер; переиспользовать в editorial TRENDING и оставить discovery как есть, если рефактор дороже — тогда билдер живёт в editorial; решает исполнитель по факту, приоритет — не дублировать SQL)
- Modify: `packages/db/src/queries/discovery.ts` (`getPersonalTrackPicks`: артисты из getTasteProfile.topArtistIds ∪ текущая логика; исключить лайкнутые юзером и играные за 14 дней треки)

**Изменения editorial:**
1. `moodTrackIds()` и `mixRows()`: `ORDER BY (plays за 30 дней) DESC, releases.release_date DESC` + `random()`-довесок малого веса для ротации; LIMIT 25 остаётся. Даты — только в SQL.
2. `generatePersonalPlaylists`: сигнал из `getTasteProfile(userId)` (moods + genres): «Для тебя» = микс по topMoods И topGenres (жанровые треки через track_genres); exclusion set — накапливать выданные trackIds внутри прогона, mood-подборки не включают треки «Для тебя».
3. Число и приоритеты подборок не менять.

**Steps:**
- [ ] Реализовать; `pnpm --filter @vire/db typecheck` и `pnpm --filter @vire/web typecheck` зелёные; воркер: `pnpm --filter @vire/worker typecheck`.
- [ ] Ручная проверка: `POST /api/v1/admin/editorial` локально (или прямой вызов `generateAllEditorialPlaylists` скриптом) — подборки наполняются, порядок не «первые попавшиеся».
- [ ] Commit: `feat(recs): ранжирование подборок, вкус (mood+genre) в личных, свежий getPersonalTrackPicks`.

### Task C2: дедуп секций главной

**Files:**
- Modify: `apps/web/app/(listener)/page.tsx`

После `Promise.all`: собрать `Set` id треков «Продолжить слушать»; отфильтровать из «Для тебя» (personal picks) пересечения; «Горячие треки» не трогать. Если после фильтра «Для тебя» < 4 треков — секция скрывается (существующее правило самоскрытия).

**Steps:**
- [ ] Реализовать фильтр (чистая функция рядом в модуле или inline — по размеру);
- [ ] `typecheck && test` зелёные. Commit: `feat(home): «Для тебя» без повторов с «Продолжить слушать»`.

---

## Фаза D — редизайн UI (Impeccable по умолчанию; перед работой прочитать skill `impeccable`/`make-interfaces-feel-better`)

### Task D1: блок «Поток» на главной — mood + genre чипы

**Files:**
- Modify: `apps/web/components/home/flow-block.tsx`, `components/mood-wave-chips.tsx`, `components/wave-start-button.tsx`
- Create (если нужно по декомпозиции): `apps/web/components/home/wave-chips.tsx` (общий чип-рейл: принимает элементы `{key,label,count,kind:'mood'|'genre'}`)
- Modify: `apps/web/app/(listener)/page.tsx` (передать `getGenreCounts()` в FlowBlock)

Дизайн: один блок «Поток» — большая кнопка запуска + два подписанных ряда чипов («Настроение», «Жанр»), горизонтальный скролл на мобилке (`overflow-x-auto`, без вертикального роста), состояние «играет» (кнопка → Остановить, активный чип подсвечен акцентом). Жанровые подписи — из `apps/web/lib/genres.ts`. Все чипы зовут `controls.startWave({ mood } | { genre })`; toast при ошибке. Никаких `min-h-screen`. `prefers-reduced-motion` уважать.

**Steps:**
- [ ] Реализовать; проверить мобильную вёрстку (узкий вьюпорт) и пустые состояния (0 жанров с треками).
- [ ] `typecheck && lint && test && audit:design` зелёные. Commit: `feat(home): Поток с жанровыми чипами (редизайн блока)`.

### Task D2: редизайн мини-бара и фуллскрин-плеера

**Files:**
- Modify: `apps/web/components/player/index.tsx` (декомпозировать: `mini-bar.tsx`, `fullscreen.tsx`, `queue-panel.tsx` в `components/player/` — файл разросся)
- Keep: жесты (swipe-down), хоткеи, existing `use-player-hotkeys.ts`, поведение громкости (`is-desktop-pointer`), share/like/LRC.

Дизайн-указания (в остальном — вкус исполнителя по Impeccable):
- Мини-бар: прогресс — тонкая линия по верхней кромке бара (useAudioTime), обложка 40px со скруглением токена, тайтл/артист ссылками, лайк, индикатор «Волна» (когда waveMode), кнопка очереди, play/pause с моушном; акцент — `--artist-accent` (теперь всегда есть).
- Фуллскрин: фон — глубокий OKLCH-градиент от акцента (не серый), крупная обложка (shared layoutId сохранить), waveform-скраббер из B4, панель «Дальше» (queue-panel: очередь с текущим, включая буфер волны, бейдж «Волна подобрала»), LRC-режим как сейчас, explicit-бейдж.
- Restored-состояние (B1): плеер виден на паузе с сохранённым треком/позицией; первый тап play → `controls.resumeRestored()`.
- Мобилка: всё влезает в узкий вьюпорт, скролл очереди — внутри панели (`overflow-y-auto min-h-0`), не страницей.

**Steps:**
- [ ] Прочитать `impeccable`-скилл; декомпозировать и реализовать; прогнать вручную dev (десктоп+мобильный вьюпорт): мини-бар, фуллскрин, очередь, restored-после-F5, волна.
- [ ] `typecheck && lint && test && audit:design && build` зелёные. Commit: `feat(player): редизайн мини-бара и фуллскрина, панель «Дальше», restore после перезагрузки`.

---

## Фаза E — финиш

### Task E1: документация фич

**Files:**
- Modify: `docs/features/wave.md` (реальные пути: packages/db/queries/wave.ts, core/musical-key, redis-сессия, пачки, seed v2, жанры)
- Modify: `docs/features/player.md` (store persist, engine v2, usePlay, PlayContext, скраббер, перф-модель)
- Modify: `docs/features/home-feed.md` (Поток с жанрами, дедуп «Для тебя»)
- Modify: `docs/features/curated-playlists.md` (ранжирование, вкус mood+genre)
- Modify: `CLAUDE.md` (строки статуса: Волна ступень 2, персист плеера — кратко)

- [ ] Обновить; commit: `docs(features): актуализация wave/player/home/curated после переработки`.

### Task E2: полные гейты, самокритика, версия

- [ ] Прогнать ВСЕ гейты: `typecheck, lint, check:routes, test, audit:design, build` (web) + `pnpm --filter @vire/worker typecheck` + core/db тесты.
- [ ] Независимая самокритика сабагентом (Sonnet) по Vire-чеклисту; фиксы; повторный прогон.
- [ ] Версия: корневой `package.json` + `apps/web/package.json` → 1.8.0; `pnpm install`; коммит lockfile.
- [ ] Итоговый отчёт владельцу (деплой-тег — только по команде).

## Порядок и параллель

A1→A2→A3→A4→A5→A6 (A2/A3 параллельны; A6 параллелен A4/A5). B1→B2→B3→B4 (строго последовательно). C1/C2 параллельны фазе B после A3. D1 после B3 (startWave) и A3 (getGenreCounts); D2 после B4. E после всего.
