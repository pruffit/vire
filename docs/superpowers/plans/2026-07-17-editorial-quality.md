# §7.2 Editorial Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Поднять качество и разнообразие editorial-подборок: artist cap, честная семантика RELISTEN, фильтры видимости, affinity-ранжирование личных.

**Architecture:** Чистая политика композиции (`composePlaylist`) в `editorial-policy.ts` (юнит-тесты без БД); SQL-выборки в `editorial.ts`/`popularity.ts` начинают возвращать кандидатов `{trackId, artistId}` и ранжировать личные по matchScore. Спека: `docs/superpowers/specs/2026-07-17-editorial-quality-design.md`.

**Tech Stack:** TypeScript strict, Drizzle ORM, Vitest (`pnpm --filter @vire/db test`).

## Global Constraints

- Комментарии — почти никогда: только неочевидное «почему», 1–2 строки (CLAUDE.md).
- Не интерполировать колонку через `${column}` внутри `sql` в коррелированных подзапросах — литералы (`pe.track_id = tracks.id`).
- Не интерполировать JS-`Date` в raw-`sql` — даты считать в SQL.
- Схема БД, воркер, UI не меняются. Никаких новых зависимостей.
- Каждая задача завершается зелёным `pnpm --filter @vire/db test` и `pnpm --filter @vire/db typecheck`, затем коммит.

---

### Task 1: `composePlaylist` в editorial-policy (TDD)

**Files:**
- Modify: `packages/db/src/queries/editorial-policy.ts`
- Test: `packages/db/src/queries/editorial-policy.test.ts`

**Interfaces:**
- Produces: `interface PlaylistCandidate { trackId: string; artistId: string }`, `const MAX_PER_ARTIST = 3`, `function composePlaylist(genuine: PlaylistCandidate[], pool: PlaylistCandidate[], avoid?: ReadonlySet<string>, limit?: number, maxPerArtist?: number): string[]`. `fillToLimit` в этой задаче НЕ трогать (удаляется в Task 2).

- [ ] **Step 1: Write the failing tests**

Добавить в `editorial-policy.test.ts` импорты `composePlaylist`, `MAX_PER_ARTIST`, `type PlaylistCandidate` и блок:

```ts
describe('composePlaylist', () => {
  const c = (trackId: string, artistId: string): PlaylistCandidate => ({ trackId, artistId });
  const many = (prefix: string, artistId: string, n: number) =>
    Array.from({ length: n }, (_, i) => c(`${prefix}${i}`, artistId));

  it('caps an artist in the head, deferring overflow after other artists but before filler', () => {
    const genuine = [...many('a', 'A', 5), c('b0', 'B'), c('c0', 'C')];
    const pool = many('p', 'P', 10);
    const out = composePlaylist(genuine, pool, new Set(), 10);
    expect(out).toEqual(['a0', 'a1', 'a2', 'b0', 'c0', 'a3', 'a4', 'p0', 'p1', 'p2']);
  });

  it('never evicts genuine in favour of filler', () => {
    const genuine = many('a', 'A', 6);
    const pool = many('p', 'P', 10);
    const out = composePlaylist(genuine, pool, new Set(), 6);
    expect(out).toEqual(['a0', 'a1', 'a2', 'a3', 'a4', 'a5']);
  });

  it('applies the cap to filler counting tracks already picked from genuine', () => {
    const genuine = [c('g0', 'A'), c('g1', 'A')];
    const pool = [c('p0', 'A'), c('p1', 'A'), c('p2', 'B')];
    const out = composePlaylist(genuine, pool, new Set(), 4);
    expect(out).toEqual(['g0', 'g1', 'p0', 'p2']);
  });

  it('relaxes the filler cap only when diverse pool candidates run out', () => {
    const genuine = [c('g0', 'A')];
    const pool = [c('p0', 'B'), c('p1', 'B'), c('p2', 'B'), c('p3', 'B'), c('p4', 'B')];
    const out = composePlaylist(genuine, pool, new Set(), 5);
    expect(out).toEqual(['g0', 'p0', 'p1', 'p2', 'p3']);
  });

  it('prefers unused pool candidates, reusing avoided ones only when the pool runs dry', () => {
    const genuine = [c('g0', 'G')];
    const pool = [c('u0', 'U'), c('u1', 'U2'), c('f0', 'F'), c('f1', 'F2')];
    const out = composePlaylist(genuine, pool, new Set(['u0', 'u1']), 4);
    expect(out).toEqual(['g0', 'f0', 'f1', 'u0']);
  });

  it('deduplicates genuine tracks that also appear in the pool', () => {
    const out = composePlaylist([c('a', 'A')], [c('a', 'A'), c('b', 'B')], new Set(), 2);
    expect(out).toEqual(['a', 'b']);
  });

  it('returns fewer than limit only when genuine plus pool are smaller than the limit', () => {
    const out = composePlaylist([c('g0', 'A')], [c('p0', 'B')], new Set(), 5);
    expect(out).toEqual(['g0', 'p0']);
  });

  it('defaults to the playlist list limit and MAX_PER_ARTIST', () => {
    const out = composePlaylist([], many('p', 'P', PLAYLIST_LIST_LIMIT + 10));
    expect(out).toHaveLength(PLAYLIST_LIST_LIMIT);
    expect(MAX_PER_ARTIST).toBe(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vire/db test`
Expected: FAIL — `composePlaylist` не экспортирован.

- [ ] **Step 3: Implement**

Добавить в `editorial-policy.ts`:

```ts
export interface PlaylistCandidate {
  trackId: string;
  artistId: string;
}

export const MAX_PER_ARTIST = 3;

export function composePlaylist(
  genuine: PlaylistCandidate[],
  pool: PlaylistCandidate[],
  avoid: ReadonlySet<string> = new Set(),
  limit: number = PLAYLIST_LIST_LIMIT,
  maxPerArtist: number = MAX_PER_ARTIST,
): string[] {
  const out: string[] = [];
  const have = new Set<string>();
  const perArtist = new Map<string, number>();

  const push = (cand: PlaylistCandidate) => {
    out.push(cand.trackId);
    have.add(cand.trackId);
    perArtist.set(cand.artistId, (perArtist.get(cand.artistId) ?? 0) + 1);
  };

  // cap переупорядочивает genuine, но не выбрасывает: подлинное совпадение важнее филлера
  const deferred: PlaylistCandidate[] = [];
  for (const cand of genuine) {
    if (out.length >= limit) break;
    if (have.has(cand.trackId)) continue;
    if ((perArtist.get(cand.artistId) ?? 0) >= maxPerArtist) {
      deferred.push(cand);
      continue;
    }
    push(cand);
  }
  for (const cand of deferred) {
    if (out.length >= limit) break;
    if (!have.has(cand.trackId)) push(cand);
  }

  const passes: Array<(cand: PlaylistCandidate) => boolean> = [
    (cand) => !avoid.has(cand.trackId) && (perArtist.get(cand.artistId) ?? 0) < maxPerArtist,
    (cand) => !avoid.has(cand.trackId),
    () => true,
  ];
  for (const pass of passes) {
    for (const cand of pool) {
      if (out.length >= limit) break;
      if (have.has(cand.trackId) || !pass(cand)) continue;
      push(cand);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vire/db test`
Expected: PASS (все, включая старые `fillToLimit`).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries/editorial-policy.ts packages/db/src/queries/editorial-policy.test.ts
git commit -m "feat(editorial): composePlaylist — artist cap в композиции подборок (§7.2)"
```

---

### Task 2: Кандидаты, видимость, RELISTEN-семантика, affinity — миграция editorial.ts

**Files:**
- Modify: `packages/db/src/queries/popularity.ts`
- Modify: `packages/db/src/queries/editorial.ts`
- Modify: `packages/db/src/queries/editorial-policy.ts` (удалить `fillToLimit`)
- Test: `packages/db/src/queries/editorial-policy.test.ts` (удалить describe `fillToLimit`)

**Interfaces:**
- Consumes: `composePlaylist`, `PlaylistCandidate`, `MAX_PER_ARTIST` из Task 1.
- Produces: `popularity.ts` — `topTrackCandidatesByPlays(days: number, limit: number): Promise<PlaylistCandidate[]>` (замена `topTrackIdsByPlays`, других потребителей нет). `editorial.ts` — публичные сигнатуры (`generateSharedPlaylists`, `generatePersonalPlaylists`, `generatePersonalPlaylistsForAllUsers`, `generateAllEditorialPlaylists`) не меняются.

- [ ] **Step 1: popularity.ts — кандидаты вместо id**

Заменить `topTrackIdsByPlays` на:

```ts
import type { PlaylistCandidate } from './editorial-policy';

export async function topTrackCandidatesByPlays(days: number, limit: number): Promise<PlaylistCandidate[]> {
  const score = popularityScoreSql(days);
  const rows = await db
    .select({ trackId: tracks.id, artistId: artistProfiles.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    .orderBy(desc(score), desc(releases.releaseDate))
    .limit(limit);
  return rows;
}
```

- [ ] **Step 2: editorial.ts — миграция целиком**

Импорты: `composePlaylist`, `MAX_PER_ARTIST` (вместо `fillToLimit`), `type PlaylistCandidate` из `./editorial-policy`; `topTrackCandidatesByPlays` из `./popularity`; удалить локальный `releaseIsPublic` (и ставшие лишними импорты `or`/`lte`/`count`, если не используются) — FRESH и mood-счётчик переходят на `visibleTrackWhere`.

`getFillerPool` → `Promise<PlaylistCandidate[]>` (select `{ trackId: tracks.id, artistId: artistProfiles.id }`, остальное без изменений).

`markFiller` не меняется (границы: все genuine стоят в выдаче раньше любого филлера).

TRENDING:

```ts
async function generateTrendingPlaylist(pool: PlaylistCandidate[], usedFiller: Set<string>): Promise<void> {
  const candidates = await topTrackCandidatesByPlays(7, LIST_LIMIT);
  if (candidates.length < MIN_TRACKS) return;

  const full = composePlaylist(candidates, pool, usedFiller);
  markFiller(full, candidates.length, usedFiller);
  await upsertEditorialPlaylist({
    kind: 'TRENDING',
    title: 'Сейчас набирает',
    description: 'Треки с наибольшим числом прослушиваний за последнюю неделю',
    trackIds: full,
  });
}
```

RELISTEN — возврат = один и тот же слушатель (`COALESCE(user_id::text, session_id)`) в 2+ разных дня за 30 дней; кандидаты только видимые:

```ts
const relistenersSql = sql<number>`(
  SELECT COUNT(*)::int FROM (
    SELECT 1 FROM play_events pe
    WHERE pe.track_id = tracks.id
      AND pe.started_at >= now() - interval '30 days'
    GROUP BY COALESCE(pe.user_id::text, pe.session_id)
    HAVING COUNT(DISTINCT DATE(pe.started_at)) >= 2
  ) returned
)`;

async function generateRelistenPlaylist(pool: PlaylistCandidate[], usedFiller: Set<string>): Promise<void> {
  const rows = await db
    .select({ trackId: tracks.id, artistId: artistProfiles.id, relisteners: relistenersSql })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    .orderBy(desc(relistenersSql), desc(releases.releaseDate))
    .limit(LIST_LIMIT);

  const candidates = rows.filter((r) => Number(r.relisteners) > 0);
  if (candidates.length < MIN_TRACKS) return;

  const full = composePlaylist(candidates, pool, usedFiller);
  markFiller(full, candidates.length, usedFiller);
  await upsertEditorialPlaylist({
    kind: 'RELISTEN',
    title: 'Возвращаются снова',
    description: 'Треки, к которым слушатели возвращаются снова и снова',
    trackIds: full,
  });
}
```

FRESH — `visibleTrackWhere` (добавить join `artistProfiles`) вместо `READY + releaseIsPublic`:

```ts
async function generateFreshPlaylist(pool: PlaylistCandidate[], usedFiller: Set<string>): Promise<void> {
  const rows = await db
    .select({ trackId: tracks.id, artistId: artistProfiles.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    .orderBy(desc(releases.releaseDate))
    .limit(LIST_LIMIT);

  if (rows.length < MIN_TRACKS) return;

  const full = composePlaylist(rows, pool, usedFiller);
  markFiller(full, rows.length, usedFiller);
  await upsertEditorialPlaylist({
    kind: 'FRESH',
    title: 'Свежее',
    description: 'Только что опубликованные треки',
    trackIds: full,
  });
}
```

`generateTopMoodPlaylists`: mood-счётчик остаётся как есть (`eq(tracks.status,'READY')`); внутри цикла — `const candidates = await selectCandidatesByTaste([mood as Mood], [], []);`, порог по `candidates.length`, `composePlaylist(candidates, pool, usedFiller)`, `markFiller(full, candidates.length, usedFiller)`.

`selectTrackIdsByTaste` → `selectCandidatesByTaste` (личный вкус ранжирует раньше глобальной популярности):

```ts
async function selectCandidatesByTaste(
  moods: Mood[],
  genres: TrackGenre[],
  affinityArtistIds: string[],
): Promise<PlaylistCandidate[]> {
  if (moods.length === 0 && genres.length === 0) return [];

  const moodMatch = moods.length > 0
    ? sql`EXISTS (SELECT 1 FROM track_moods tm WHERE tm.track_id = tracks.id AND tm.mood::text = ANY(${textArrayParam(moods)}))`
    : sql`false`;
  const genreMatch = genres.length > 0
    ? sql`EXISTS (SELECT 1 FROM track_genres tg WHERE tg.track_id = tracks.id AND tg.genre::text = ANY(${textArrayParam(genres)}))`
    : sql`false`;
  const artistMatch = affinityArtistIds.length > 0
    ? sql`releases.artist_profile_id::text = ANY(${textArrayParam(affinityArtistIds)})`
    : sql`false`;

  const matchScore = sql<number>`(CASE WHEN ${moodMatch} THEN 1 ELSE 0 END) + (CASE WHEN ${genreMatch} THEN 1 ELSE 0 END) + (CASE WHEN ${artistMatch} THEN 2 ELSE 0 END)`;

  const score = popularityScoreSql(30);
  const rows = await db
    .select({ trackId: tracks.id, artistId: artistProfiles.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(visibleTrackWhere, sql`(${moodMatch} OR ${genreMatch})`))
    .orderBy(desc(matchScore), desc(score), desc(releases.releaseDate))
    .limit(LIST_LIMIT);
  return rows;
}
```

`generatePersonalPlaylists` — миграция на кандидатов + affinity:

```ts
  const pool = sharedPool ?? (await getFillerPool());
  const exclude = new Set<string>();
  let made = 0;

  // «Для тебя»: неполную подборку (каталог меньше лимита) не публикуем
  const mixCandidates = await selectCandidatesByTaste(taste.topMoods, taste.topGenres, taste.topArtistIds);
  if (hasEnoughTracksForPersonalPlaylist(mixCandidates.length)) {
    const fullMix = composePlaylist(mixCandidates, pool);
    if (fullMix.length === LIST_LIMIT) {
      await createPersonalPlaylist({
        userId,
        title: 'Для тебя',
        description: 'Подобрано по твоим лайкам и прослушиваниям',
        trackIds: fullMix,
      });
      fullMix.forEach((id) => exclude.add(id));
      made += 1;
    }
  }

  const sharedMoods = await sharedMoodPlaylistMoods();
  const personalMoods = pickPersonalMoods(taste.topMoods, sharedMoods, taste.topMoods.length);

  for (const mood of personalMoods) {
    if (made >= PERSONAL_MAX) break;
    const label = MOOD_LABELS[mood];
    // порог сигнала проверяем до фильтра эксклюзией — иначе разбор «Для тебя» занижает сигнал
    const genuine = await selectCandidatesByTaste([mood], [], taste.topArtistIds);
    if (!hasEnoughTracksForPersonalPlaylist(genuine.length)) continue;
    const candidates = genuine.filter((cand) => !exclude.has(cand.trackId));
    const fullTrackIds = composePlaylist(candidates, pool, exclude);
    if (fullTrackIds.length < LIST_LIMIT) continue;
    await createPersonalPlaylist({
      userId,
      title: `${label} — для тебя`,
      description: `Тебе заходит «${label}»`,
      trackIds: fullTrackIds,
    });
    fullTrackIds.forEach((id) => exclude.add(id));
    made += 1;
  }
```

- [ ] **Step 3: Удалить `fillToLimit`**

Из `editorial-policy.ts` — функцию, из `editorial-policy.test.ts` — describe-блок и импорт.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @vire/db typecheck && pnpm --filter @vire/db test`
Expected: PASS. Также `pnpm --filter @vire/web typecheck` (потребителей сигнатур нет, но проверить).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries
git commit -m "feat(editorial): artist cap, честный RELISTEN, видимость, affinity-ранжирование (§7.2)"
```

---

### Task 3: Документация

**Files:**
- Modify: `docs/features/curated-playlists.md`
- Modify: `docs/roadmap/stage-2.md` (§7.2 → ✅, сводка)

Обновить описания: RELISTEN = вернувшиеся слушатели (user_id/session_id, 2+ разных дня), artist cap `MAX_PER_ARTIST=3` через `composePlaylist` (замена `fillToLimit`), фильтры видимости RELISTEN/FRESH, matchScore личных (mood+genre+артисты вкуса). Коммит `docs(editorial): §7.2 закрыт — качество/разнообразие подборок`.

---

### Verification (полный контракт vire-loop)

```bash
pnpm --filter @vire/db typecheck && pnpm --filter @vire/db test
pnpm --filter @vire/core typecheck
pnpm --filter @vire/web typecheck && pnpm --filter @vire/web lint
pnpm --filter @vire/web check:routes && pnpm --filter @vire/web test
pnpm --filter @vire/web build
```

Плюс рантайм-прогон SQL (typecheck не ловит SQL-синтаксис): при поднятом локальном postgres — tsx-скрипт в scratchpad, зовущий `generateSharedPlaylists()` + `generatePersonalPlaylistsForAllUsers()`, убедиться в отсутствии ошибок и полных карточках.
