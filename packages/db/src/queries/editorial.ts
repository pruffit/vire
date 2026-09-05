import { desc, eq, gte, sql, and, count, inArray, isNotNull, type SQL } from 'drizzle-orm';
import { db } from '../client';
import { tracks, releases, artistProfiles, trackMoods, playEvents, likes, playlists, playlistTracks } from '../schema';
import { upsertEditorialPlaylist, createPersonalPlaylist, deletePersonalPlaylists } from './playlist-editorial';
import { MOOD_LABELS, type Mood } from './track-moods';
import type { TrackGenre } from './track-genres';
import { getTasteProfile, materializeTasteProfiles, clearTasteProfileCache } from './taste';
import { textArrayParam, visibleTrackWhere } from './wave';
import { popularityScoreSql, topTrackCandidatesByPlays } from './popularity';
import {
  hasEnoughTracksForPersonalPlaylist,
  pickPersonalMoods,
  composePlaylist,
  type PlaylistCandidate,
  PLAYLIST_LIST_LIMIT as LIST_LIMIT,
} from './editorial-policy';

const SHARED_MOOD_COUNT = 3; // сколько топ-настроений держим в общих подборках
const PERSONAL_MAX = 4; // максимум личных подборок на юзера
const MIN_TRACKS = 3; // не генерируем подборку при подлинном сигнале короче этого
const TASTE_WINDOW = "now() - interval '90 days'"; // окно истории прослушиваний для вкуса

/** Общие + личные подборки. По расписанию воркер зовёт их раздельно (00:00 / раз в 4ч). */
export async function generateAllEditorialPlaylists(): Promise<void> {
  await generateSharedPlaylists();
  await generatePersonalPlaylistsForAllUsers();
}

// Общие подборки: одинаковы для всех, обновляются раз в сутки

export async function generateSharedPlaylists(): Promise<void> {
  // общий пул + набор занятых треков — иначе хвосты карточек сходятся к одному топу
  const pool = await getFillerPool();
  const usedFiller = new Set<string>();
  await generateTrendingPlaylist(pool, usedFiller);
  await generateRelistenPlaylist(pool, usedFiller);
  await generateFreshPlaylist(pool, usedFiller);
  await generateTopMoodPlaylists(pool, usedFiller);
}

/** Филлерный хвост (всё после подлинных совпадений) — в набор занятого. */
function markFiller(full: string[], genuineCount: number, usedFiller: Set<string>): void {
  for (const id of full.slice(genuineCount)) usedFiller.add(id);
}

/** «Сейчас набирает» — треки с наибольшим числом прослушиваний за 7 дней. */
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

const relistenersSql = sql<number>`(
  SELECT COUNT(*)::int FROM (
    SELECT 1 FROM play_events pe
    WHERE pe.track_id = tracks.id
      AND pe.started_at >= now() - interval '30 days'
    GROUP BY COALESCE(pe.user_id::text, pe.session_id)
    HAVING COUNT(DISTINCT DATE(pe.started_at)) >= 2
  ) returned
)`;

/** «Возвращаются снова»: один и тот же слушатель вернулся минимум дважды в разные дни. */
async function generateRelistenPlaylist(pool: PlaylistCandidate[], usedFiller: Set<string>): Promise<void> {
  const rows = await db
    .select({ trackId: tracks.id, artistId: artistProfiles.id, relisteners: relistenersSql.as('relisteners') })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    // ORDER BY по алиасу: повтор подзапроса в orderBy заставил бы Postgres считать агрегат дважды
    .orderBy(sql`relisteners DESC`, desc(releases.releaseDate))
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

/** «Свежее» — последние опубликованные треки. */
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

/** Только SHARED_MOOD_COUNT самых наполненных настроений; остальные mood-подборки удаляются. */
async function generateTopMoodPlaylists(pool: PlaylistCandidate[], usedFiller: Set<string>): Promise<void> {
  const moodRows = await db
    .select({ mood: trackMoods.mood, c: count() })
    .from(trackMoods)
    .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    .groupBy(trackMoods.mood)
    .orderBy(desc(count()))
    .limit(SHARED_MOOD_COUNT);

  const keepMoods: Mood[] = [];
  for (const { mood } of moodRows) {
    const title = MOOD_LABELS[mood as Mood];
    const candidates = await selectCandidatesByTaste([mood as Mood], [], []);
    if (candidates.length < MIN_TRACKS) continue;
    const full = composePlaylist(candidates, pool, usedFiller);
    markFiller(full, candidates.length, usedFiller);
    await upsertEditorialPlaylist({
      kind: 'MOOD',
      title,
      description: `Подборка треков в настроении «${title}»`,
      editorialParams: { mood: mood as Mood },
      trackIds: full,
    });
    keepMoods.push(mood as Mood);
  }

  await deleteStaleMoodPlaylists(keepMoods);
}

/** Видимые треки с любым из заданных настроений/жанров, отранжированные по совпадению вкуса и популярности. */
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

const FILLER_POOL_LIMIT = 500;

/** Пул филлера по популярности за 30 дней. Считается один раз на прогон (тяжёлый скан play_events). */
async function getFillerPool(): Promise<PlaylistCandidate[]> {
  const rows = await db
    .select({ trackId: tracks.id, artistId: artistProfiles.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    .orderBy(desc(popularityScoreSql(30)), desc(releases.releaseDate))
    .limit(FILLER_POOL_LIMIT);
  return rows;
}

/** Общие MOOD-подборки вне keepMoods (и легаси без params). Внешние скобки обязательны:
 *  drizzle склеивает элементы and() без них, и OR вырвался бы наружу, снося чужие строки. */
export function staleMoodPlaylistWhere(keepMoods: Mood[]): SQL {
  const outOfKeep = keepMoods.length > 0
    ? sql`((${playlists.editorialParams}->>'mood') IS NULL OR (${playlists.editorialParams}->>'mood') <> ALL(${textArrayParam(keepMoods)}))`
    : sql`true`;
  return and(
    eq(playlists.isCurated, true),
    eq(playlists.kind, 'MOOD'),
    sql`${playlists.targetUserId} IS NULL`,
    outOfKeep,
  )!;
}

async function deleteStaleMoodPlaylists(keepMoods: Mood[]): Promise<void> {
  const stale = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(staleMoodPlaylistWhere(keepMoods));
  if (stale.length === 0) return;
  const ids = stale.map((r) => r.id);
  await db.delete(playlistTracks).where(inArray(playlistTracks.playlistId, ids));
  await db.delete(playlists).where(inArray(playlists.id, ids));
}

/** Настроения общих MOOD-подборок — личные их пропускают, иначе дубль общей/личной карточки. */
async function sharedMoodPlaylistMoods(): Promise<Mood[]> {
  const rows = await db
    .select({ mood: sql<string | null>`${playlists.editorialParams}->>'mood'` })
    .from(playlists)
    .where(and(
      eq(playlists.isCurated, true),
      eq(playlists.kind, 'MOOD'),
      sql`${playlists.targetUserId} IS NULL`,
    ));
  return rows.map((r) => r.mood).filter((m): m is Mood => m !== null);
}

// Личные подборки: под каждого юзера, обновляются раз в 4 часа

/** Генерирует личные подборки всем юзерам, у которых есть сигнал (лайки/прослушивания). */
export async function generatePersonalPlaylistsForAllUsers(): Promise<void> {
  const likeUsers = await db.selectDistinct({ userId: likes.userId }).from(likes);
  const playUsers = await db
    .selectDistinct({ userId: playEvents.userId })
    .from(playEvents)
    .where(and(isNotNull(playEvents.userId), gte(playEvents.startedAt, sql.raw(TASTE_WINDOW))));

  const userIds = [
    ...new Set([
      ...likeUsers.map((u) => u.userId),
      ...playUsers.map((u) => u.userId).filter((id): id is string => id !== null),
    ]),
  ];

  await materializeTasteProfiles(userIds);
  clearTasteProfileCache();

  // последовательно — фоновая генерация, нагрузку на БД не разгоняем
  const pool = await getFillerPool();
  for (const userId of userIds) {
    await generatePersonalPlaylists(userId, pool);
  }
}

async function tasteSignalTrackCount(userId: string): Promise<number> {
  const [likedRows, playedRows] = await Promise.all([
    db.select({ trackId: likes.trackId }).from(likes).where(eq(likes.userId, userId)),
    db
      .selectDistinct({ trackId: playEvents.trackId })
      .from(playEvents)
      .where(and(eq(playEvents.userId, userId), gte(playEvents.startedAt, sql.raw(TASTE_WINDOW)))),
  ]);
  return new Set([...likedRows.map((r) => r.trackId), ...playedRows.map((r) => r.trackId)]).size;
}

/** Личные подборки на основе getTasteProfile (лайки + прослушивания за 90 дней). */
export async function generatePersonalPlaylists(userId: string, sharedPool?: PlaylistCandidate[]): Promise<void> {
  const signalCount = await tasteSignalTrackCount(userId);

  // полный пересбор: проще upsert по меняющимся заголовкам
  await deletePersonalPlaylists(userId);
  if (signalCount < MIN_TRACKS) return;

  const taste = await getTasteProfile(userId);
  if (taste.topMoods.length === 0 && taste.topGenres.length === 0) return;

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

  // до PERSONAL_MAX mood-подборок, без пересечения с «Для тебя» и с общими MOOD-подборками
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
      editorialParams: { mood },
      trackIds: fullTrackIds,
    });
    fullTrackIds.forEach((id) => exclude.add(id));
    made += 1;
  }
}
