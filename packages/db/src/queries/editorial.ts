import { desc, eq, gte, lte, or, sql, and, count, inArray, notInArray, isNotNull } from 'drizzle-orm';
import { db } from '../client';
import { tracks, releases, trackMoods, playEvents, likes, playlists, playlistTracks } from '../schema';
import { upsertEditorialPlaylist, createPersonalPlaylist, deletePersonalPlaylists } from './playlists';
import { MOOD_LABELS, type Mood } from './track-moods';

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
  const rows = await db
    .select({ trackId: playEvents.trackId, plays: count() })
    .from(playEvents)
    .where(gte(playEvents.startedAt, sql`now() - interval '7 days'`))
    .groupBy(playEvents.trackId)
    .orderBy(desc(count()))
    .limit(LIST_LIMIT);

  if (rows.length < MIN_TRACKS) return;

  await upsertEditorialPlaylist({
    kind: 'TRENDING',
    title: 'Сейчас набирает',
    description: 'Треки с наибольшим числом прослушиваний за последнюю неделю',
    trackIds: rows.map((r) => r.trackId),
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

/** READY-треки в данном настроении (id, до LIST_LIMIT). */
async function moodTrackIds(mood: Mood): Promise<string[]> {
  const rows = await db
    .select({ trackId: trackMoods.trackId })
    .from(trackMoods)
    .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(and(eq(trackMoods.mood, mood), eq(tracks.status, 'READY'), releaseIsPublic))
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

/**
 * Личные подборки одного юзера на основе лайков + истории прослушиваний +
 * настроений этих треков. Пересобираются целиком. Нет сигнала → подборки
 * удаляются, на главной личную половину закрывает фолбэк на популярное.
 */
export async function generatePersonalPlaylists(userId: string): Promise<void> {
  const likedRows = await db
    .select({ trackId: likes.trackId })
    .from(likes)
    .where(eq(likes.userId, userId));
  const playedRows = await db
    .selectDistinct({ trackId: playEvents.trackId })
    .from(playEvents)
    .where(and(eq(playEvents.userId, userId), gte(playEvents.startedAt, sql.raw(TASTE_WINDOW))));

  const tasteTrackIds = [
    ...new Set([...likedRows.map((r) => r.trackId), ...playedRows.map((r) => r.trackId)]),
  ];

  if (tasteTrackIds.length < MIN_TRACKS) {
    await deletePersonalPlaylists(userId);
    return;
  }

  // Топ-настроения юзера по его трекам.
  const moodRows = await db
    .select({ mood: trackMoods.mood, c: count() })
    .from(trackMoods)
    .where(inArray(trackMoods.trackId, tasteTrackIds))
    .groupBy(trackMoods.mood)
    .orderBy(desc(count()));
  const topMoods = moodRows.map((r) => r.mood as Mood);

  // Полный пересбор: проще upsert по меняющимся заголовкам.
  await deletePersonalPlaylists(userId);
  if (topMoods.length === 0) return; // фолбэк на популярное покроет

  let made = 0;

  // 1) «Для тебя» — публичные READY треки в топ-настроениях юзера.
  const mixMoods = topMoods.slice(0, 3);
  const mixRows = await db
    .selectDistinct({ trackId: trackMoods.trackId })
    .from(trackMoods)
    .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(and(inArray(trackMoods.mood, mixMoods), eq(tracks.status, 'READY'), releaseIsPublic))
    .limit(LIST_LIMIT);
  if (mixRows.length >= MIN_TRACKS) {
    await createPersonalPlaylist({
      userId,
      title: 'Для тебя',
      description: 'Подобрано по твоим лайкам и прослушиваниям',
      trackIds: mixRows.map((r) => r.trackId),
    });
    made += 1;
  }

  // 2) До PERSONAL_MAX всего — mood-подборки под топ-настроения юзера.
  for (const mood of topMoods) {
    if (made >= PERSONAL_MAX) break;
    const label = MOOD_LABELS[mood];
    const trackIds = await moodTrackIds(mood);
    if (trackIds.length < MIN_TRACKS) continue;
    await createPersonalPlaylist({
      userId,
      title: `${label} — для тебя`,
      description: `Тебе заходит «${label}»`,
      trackIds,
    });
    made += 1;
  }
}
