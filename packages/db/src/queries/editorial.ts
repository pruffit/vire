import { desc, eq, gte, lte, or, sql, and, count, inArray, notInArray, isNotNull } from 'drizzle-orm';
import { db } from '../client';
import { tracks, releases, artistProfiles, trackMoods, playEvents, likes, playlists, playlistTracks } from '../schema';
import { upsertEditorialPlaylist, createPersonalPlaylist, deletePersonalPlaylists } from './playlists';
import { MOOD_LABELS, type Mood } from './track-moods';
import type { TrackGenre } from './track-genres';
import { getTasteProfile } from './taste';
import { textArrayParam, visibleTrackWhere } from './wave';
import { popularityScoreSql, topTrackIdsByPlays } from './popularity';

// Релиз доступен (треки можно слушать): опубликован или запланирован с прошедшей
// датой. Не пускаем невышедшие релизы в подборки — иначе их можно слушать с главной.
const releaseIsPublic = or(
  eq(releases.status, 'PUBLISHED'),
  and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
);

const SHARED_MOOD_COUNT = 3; // сколько топ-настроений держим в общих подборках
const PERSONAL_MAX = 4; // максимум личных подборок на юзера
const MIN_TRACKS = 3; // не генерируем подборку короче этого
const LIST_LIMIT = 25; // треков в подборке
const TASTE_WINDOW = "now() - interval '90 days'"; // окно истории прослушиваний для вкуса

/**
 * Полный прогон генерации: общие + личные. Ручной вызов из /api/v1/admin/editorial.
 * По расписанию воркер зовёт generateSharedPlaylists (00:00) и
 * generatePersonalPlaylistsForAllUsers (раз в 4 часа) раздельно.
 */
export async function generateAllEditorialPlaylists(): Promise<void> {
  await generateSharedPlaylists();
  await generatePersonalPlaylistsForAllUsers();
}

// ─── Общие подборки (одинаковы для всех, обновляются раз в сутки) ────────────

export async function generateSharedPlaylists(): Promise<void> {
  await Promise.all([
    generateTrendingPlaylist(),
    generateRelistenPlaylist(),
    generateFreshPlaylist(),
    generateTopMoodPlaylists(),
  ]);
}

/** «Сейчас набирает» — треки с наибольшим числом прослушиваний за 7 дней. */
async function generateTrendingPlaylist(): Promise<void> {
  const trackIds = await topTrackIdsByPlays(7, LIST_LIMIT);

  if (trackIds.length < MIN_TRACKS) return;

  await upsertEditorialPlaylist({
    kind: 'TRENDING',
    title: 'Сейчас набирает',
    description: 'Треки с наибольшим числом прослушиваний за последнюю неделю',
    trackIds,
  });
}

/**
 * «Возвращаются снова» — треки, к которым слушатели возвращались
 * несколько раз (минимум 2 прослушивания от одного userId в разные дни).
 */
async function generateRelistenPlaylist(): Promise<void> {
  const rows = await db
    .select({
      trackId: playEvents.trackId,
      relisteners: sql<number>`COUNT(DISTINCT DATE(${playEvents.startedAt}))`,
    })
    .from(playEvents)
    .where(
      and(
        isNotNull(playEvents.userId),
        gte(playEvents.startedAt, sql`now() - interval '30 days'`),
      ),
    )
    .groupBy(playEvents.trackId)
    .having(sql`COUNT(DISTINCT DATE(${playEvents.startedAt})) >= 2`)
    .orderBy(desc(sql`COUNT(DISTINCT DATE(${playEvents.startedAt}))`))
    .limit(LIST_LIMIT);

  if (rows.length < MIN_TRACKS) return;

  await upsertEditorialPlaylist({
    kind: 'RELISTEN',
    title: 'Возвращаются снова',
    description: 'Треки, к которым слушатели возвращаются снова и снова',
    trackIds: rows.map((r) => r.trackId),
  });
}

/** «Свежее» — последние опубликованные треки. */
async function generateFreshPlaylist(): Promise<void> {
  const rows = await db
    .select({ id: tracks.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(and(eq(tracks.status, 'READY'), releaseIsPublic))
    .orderBy(desc(releases.releaseDate))
    .limit(LIST_LIMIT);

  if (rows.length < MIN_TRACKS) return;

  await upsertEditorialPlaylist({
    kind: 'FRESH',
    title: 'Свежее',
    description: 'Только что опубликованные треки',
    trackIds: rows.map((r) => r.id),
  });
}

/**
 * Подборки по топ-настроениям. Раньше генерились все 18 — теперь только
 * SHARED_MOOD_COUNT самых наполненных, остальные mood-подборки удаляются
 * (личные настроения каждый получает в своей половине).
 */
async function generateTopMoodPlaylists(): Promise<void> {
  const moodRows = await db
    .select({ mood: trackMoods.mood, c: count() })
    .from(trackMoods)
    .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
    .where(eq(tracks.status, 'READY'))
    .groupBy(trackMoods.mood)
    .orderBy(desc(count()))
    .limit(SHARED_MOOD_COUNT);

  const keepTitles: string[] = [];
  for (const { mood } of moodRows) {
    const title = MOOD_LABELS[mood as Mood];
    const trackIds = await moodTrackIds(mood as Mood);
    if (trackIds.length < MIN_TRACKS) continue;
    await upsertEditorialPlaylist({
      kind: 'MOOD',
      title,
      description: `Подборка треков в настроении «${title}»`,
      trackIds,
    });
    keepTitles.push(title);
  }

  await deleteStaleMoodPlaylists(keepTitles);
}

/** READY-треки в данном настроении, ранжированные по популярности (id, до LIST_LIMIT). */
async function moodTrackIds(mood: Mood): Promise<string[]> {
  const score = popularityScoreSql(30);
  const rows = await db
    .select({ trackId: trackMoods.trackId })
    .from(trackMoods)
    .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(eq(trackMoods.mood, mood), visibleTrackWhere))
    .orderBy(desc(score), desc(releases.releaseDate))
    .limit(LIST_LIMIT);
  return rows.map((r) => r.trackId);
}

/** Видимые треки в топ-настроениях ИЛИ топ-жанрах профиля вкуса, ранжированные по популярности. */
async function personalMixTrackIds(moods: Mood[], genres: TrackGenre[]): Promise<string[]> {
  if (moods.length === 0 && genres.length === 0) return [];

  const moodMatch = moods.length > 0
    ? sql`EXISTS (SELECT 1 FROM track_moods tm WHERE tm.track_id = tracks.id AND tm.mood::text = ANY(${textArrayParam(moods)}))`
    : sql`false`;
  const genreMatch = genres.length > 0
    ? sql`EXISTS (SELECT 1 FROM track_genres tg WHERE tg.track_id = tracks.id AND tg.genre::text = ANY(${textArrayParam(genres)}))`
    : sql`false`;

  const score = popularityScoreSql(30);
  const rows = await db
    .select({ trackId: tracks.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(visibleTrackWhere, sql`(${moodMatch} OR ${genreMatch})`))
    .orderBy(desc(score), desc(releases.releaseDate))
    .limit(LIST_LIMIT);
  return rows.map((r) => r.trackId);
}

/** Удаляет общие mood-подборки, не вошедшие в текущий топ. */
async function deleteStaleMoodPlaylists(keepTitles: string[]): Promise<void> {
  const stale = await db
    .select({ id: playlists.id })
    .from(playlists)
    .where(and(
      eq(playlists.isCurated, true),
      eq(playlists.kind, 'MOOD'),
      sql`${playlists.targetUserId} IS NULL`,
      keepTitles.length > 0 ? notInArray(playlists.title, keepTitles) : sql`true`,
    ));
  if (stale.length === 0) return;
  const ids = stale.map((r) => r.id);
  await db.delete(playlistTracks).where(inArray(playlistTracks.playlistId, ids));
  await db.delete(playlists).where(inArray(playlists.id, ids));
}

// ─── Личные подборки (под каждого юзера, обновляются раз в 4 часа) ───────────

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

  // Последовательно — генерация фоновая, нагрузку на БД не разгоняем.
  for (const userId of userIds) {
    await generatePersonalPlaylists(userId);
  }
}

/** Число уникальных треков сигнала юзера (лайки ∪ прослушивания за 90 дней). */
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

/**
 * Личные подборки одного юзера на основе единого профиля вкуса (getTasteProfile:
 * лайки + история прослушиваний за 90 дней). Пересобираются целиком. Нет сигнала →
 * подборки удаляются, на главной личную половину закрывает фолбэк на популярное.
 *
 * Порог минимального сигнала (MIN_TRACKS уникальных лайкнутых/прослушанных треков)
 * восстановлен — иначе одного лайка с настроением/жанром достаточно, чтобы
 * getTasteProfile вернул непустой topMoods/topGenres и собрал «Для тебя» из всего
 * каталога.
 */
export async function generatePersonalPlaylists(userId: string): Promise<void> {
  const signalCount = await tasteSignalTrackCount(userId);

  // Полный пересбор: проще upsert по меняющимся заголовкам.
  await deletePersonalPlaylists(userId);
  if (signalCount < MIN_TRACKS) return; // недостаточно сигнала для персонализации

  const taste = await getTasteProfile(userId);
  if (taste.topMoods.length === 0 && taste.topGenres.length === 0) return; // фолбэк на популярное покроет

  const exclude = new Set<string>();
  let made = 0;

  // 1) «Для тебя» — микс по топ-настроениям И топ-жанрам профиля вкуса.
  const mixTrackIds = await personalMixTrackIds(taste.topMoods, taste.topGenres);
  if (mixTrackIds.length >= MIN_TRACKS) {
    await createPersonalPlaylist({
      userId,
      title: 'Для тебя',
      description: 'Подобрано по твоим лайкам и прослушиваниям',
      trackIds: mixTrackIds,
    });
    mixTrackIds.forEach((id) => exclude.add(id));
    made += 1;
  }

  // 2) До PERSONAL_MAX всего — mood-подборки под топ-настроения юзера, без
  // пересечения с «Для тебя» (накопленный exclusion set внутри прогона).
  for (const mood of taste.topMoods) {
    if (made >= PERSONAL_MAX) break;
    const label = MOOD_LABELS[mood];
    const trackIds = (await moodTrackIds(mood)).filter((id) => !exclude.has(id));
    if (trackIds.length < MIN_TRACKS) continue;
    await createPersonalPlaylist({
      userId,
      title: `${label} — для тебя`,
      description: `Тебе заходит «${label}»`,
      trackIds,
    });
    trackIds.forEach((id) => exclude.add(id));
    made += 1;
  }
}
