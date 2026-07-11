import { desc, eq, gte, lte, or, sql, and, count, inArray, notInArray, isNotNull } from 'drizzle-orm';
import { db } from '../client';
import { tracks, releases, artistProfiles, trackMoods, playEvents, likes, playlists, playlistTracks } from '../schema';
import { upsertEditorialPlaylist, createPersonalPlaylist, deletePersonalPlaylists } from './playlists';
import { MOOD_LABELS, type Mood } from './track-moods';
import type { TrackGenre } from './track-genres';
import { getTasteProfile } from './taste';
import { textArrayParam, visibleTrackWhere } from './wave';
import { popularityScoreSql, topTrackIdsByPlays } from './popularity';
import {
  hasEnoughTracksForPersonalPlaylist,
  pickPersonalMoods,
  fillToLimit,
  PLAYLIST_LIST_LIMIT as LIST_LIMIT,
} from './editorial-policy';

// Релиз доступен (треки можно слушать): опубликован или запланирован с прошедшей
// датой. Не пускаем невышедшие релизы в подборки — иначе их можно слушать с главной.
const releaseIsPublic = or(
  eq(releases.status, 'PUBLISHED'),
  and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
);

const SHARED_MOOD_COUNT = 3; // сколько топ-настроений держим в общих подборках
const PERSONAL_MAX = 4; // максимум личных подборок на юзера
const MIN_TRACKS = 3; // не генерируем подборку при подлинном сигнале короче этого
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
  // Последовательно с общим пулом филлера и общим набором занятых им треков —
  // иначе хвосты всех общих карточек сходятся к одному и тому же топу популярного.
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
async function generateTrendingPlaylist(pool: string[], usedFiller: Set<string>): Promise<void> {
  const trackIds = await topTrackIdsByPlays(7, LIST_LIMIT);

  if (trackIds.length < MIN_TRACKS) return;

  const full = fillToLimit(trackIds, pool, usedFiller);
  markFiller(full, trackIds.length, usedFiller);
  await upsertEditorialPlaylist({
    kind: 'TRENDING',
    title: 'Сейчас набирает',
    description: 'Треки с наибольшим числом прослушиваний за последнюю неделю',
    trackIds: full,
  });
}

/**
 * «Возвращаются снова» — треки, к которым слушатели возвращались
 * несколько раз (минимум 2 прослушивания от одного userId в разные дни).
 */
async function generateRelistenPlaylist(pool: string[], usedFiller: Set<string>): Promise<void> {
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

  const full = fillToLimit(rows.map((r) => r.trackId), pool, usedFiller);
  markFiller(full, rows.length, usedFiller);
  await upsertEditorialPlaylist({
    kind: 'RELISTEN',
    title: 'Возвращаются снова',
    description: 'Треки, к которым слушатели возвращаются снова и снова',
    trackIds: full,
  });
}

/** «Свежее» — последние опубликованные треки. */
async function generateFreshPlaylist(pool: string[], usedFiller: Set<string>): Promise<void> {
  const rows = await db
    .select({ id: tracks.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(and(eq(tracks.status, 'READY'), releaseIsPublic))
    .orderBy(desc(releases.releaseDate))
    .limit(LIST_LIMIT);

  if (rows.length < MIN_TRACKS) return;

  const full = fillToLimit(rows.map((r) => r.id), pool, usedFiller);
  markFiller(full, rows.length, usedFiller);
  await upsertEditorialPlaylist({
    kind: 'FRESH',
    title: 'Свежее',
    description: 'Только что опубликованные треки',
    trackIds: full,
  });
}

/**
 * Подборки по топ-настроениям. Раньше генерились все 18 — теперь только
 * SHARED_MOOD_COUNT самых наполненных, остальные mood-подборки удаляются
 * (личные настроения каждый получает в своей половине).
 */
async function generateTopMoodPlaylists(pool: string[], usedFiller: Set<string>): Promise<void> {
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
    const trackIds = await selectTrackIdsByTaste([mood as Mood], []);
    if (trackIds.length < MIN_TRACKS) continue;
    const full = fillToLimit(trackIds, pool, usedFiller);
    markFiller(full, trackIds.length, usedFiller);
    await upsertEditorialPlaylist({
      kind: 'MOOD',
      title,
      description: `Подборка треков в настроении «${title}»`,
      trackIds: full,
    });
    keepTitles.push(title);
  }

  await deleteStaleMoodPlaylists(keepTitles);
}

/**
 * Видимые треки, помеченные любым из заданных настроений и/или жанров,
 * ранжированные по популярности (id, до LIST_LIMIT). Общий выбор и для
 * mood-подборок (один mood, пустые genres), и для микса «Для тебя»
 * (несколько moods и/или genres) — раньше это были два раздельных запроса.
 */
async function selectTrackIdsByTaste(moods: Mood[], genres: TrackGenre[]): Promise<string[]> {
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

const FILLER_POOL_LIMIT = 500;

/**
 * Пул филлера: видимые треки по популярности за 30 дней (при равенстве — свежие).
 * Считается ОДИН раз на прогон (популярность — тяжёлый коррелированный скан
 * play_events) и раздаётся всем подборкам; добивка дальше — чистый JS.
 */
async function getFillerPool(): Promise<string[]> {
  const rows = await db
    .select({ id: tracks.id })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(visibleTrackWhere)
    .orderBy(desc(popularityScoreSql(30)), desc(releases.releaseDate))
    .limit(FILLER_POOL_LIMIT);
  return rows.map((r) => r.id);
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

const MOOD_BY_LABEL: Partial<Record<string, Mood>> = Object.fromEntries(
  (Object.keys(MOOD_LABELS) as Mood[]).map((mood) => [MOOD_LABELS[mood], mood]),
);

/**
 * Настроения, уже занятые общими MOOD-подборками (target_user_id IS NULL) —
 * обратный маппинг заголовка через MOOD_LABELS. Личные mood-подборки их
 * пропускают, иначе одно настроение дублируется общей и личной карточкой.
 */
async function sharedMoodPlaylistMoods(): Promise<Mood[]> {
  const rows = await db
    .select({ title: playlists.title })
    .from(playlists)
    .where(and(
      eq(playlists.isCurated, true),
      eq(playlists.kind, 'MOOD'),
      sql`${playlists.targetUserId} IS NULL`,
    ));
  const moods: Mood[] = [];
  for (const { title } of rows) {
    const mood = MOOD_BY_LABEL[title];
    if (mood === undefined) {
      console.warn(`sharedMoodPlaylistMoods: не найдено настроение для заголовка «${title}»`);
      continue;
    }
    moods.push(mood);
  }
  return moods;
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
  // Пул филлера один на весь прогон (тяжёлый скан популярности).
  const pool = await getFillerPool();
  for (const userId of userIds) {
    await generatePersonalPlaylists(userId, pool);
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
 * каталога. Отдельно — MIN_PERSONAL_PLAYLIST_TRACKS: сама подборка не создаётся
 * короче этого, иначе получаются мусорные карточки на 3 трека.
 */
export async function generatePersonalPlaylists(userId: string, sharedPool?: string[]): Promise<void> {
  const signalCount = await tasteSignalTrackCount(userId);

  // Полный пересбор: проще upsert по меняющимся заголовкам.
  await deletePersonalPlaylists(userId);
  if (signalCount < MIN_TRACKS) return; // недостаточно сигнала для персонализации

  const taste = await getTasteProfile(userId);
  if (taste.topMoods.length === 0 && taste.topGenres.length === 0) return; // фолбэк на популярное покроет

  const pool = sharedPool ?? (await getFillerPool());
  const exclude = new Set<string>();
  let made = 0;

  // 1) «Для тебя» — микс по топ-настроениям И топ-жанрам профиля вкуса.
  // Порог — по подлинным совпадениям, витринный размер добивает филлер; неполную
  // (каталог меньше лимита) не публикуем — лучше меньше карточек, но все полные.
  const mixTrackIds = await selectTrackIdsByTaste(taste.topMoods, taste.topGenres);
  if (hasEnoughTracksForPersonalPlaylist(mixTrackIds.length)) {
    const fullMix = fillToLimit(mixTrackIds, pool);
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

  // 2) До PERSONAL_MAX всего — mood-подборки под топ-настроения юзера, без
  // пересечения с «Для тебя» (exclusion set) и без настроений, уже занятых
  // общими MOOD-подборками текущего прогона (pickPersonalMoods).
  const sharedMoods = await sharedMoodPlaylistMoods();
  const personalMoods = pickPersonalMoods(taste.topMoods, sharedMoods, taste.topMoods.length);

  for (const mood of personalMoods) {
    if (made >= PERSONAL_MAX) break;
    const label = MOOD_LABELS[mood];
    // Порог сигнала — ДО фильтра эксклюзией: то, что популярные треки настроения
    // уже разобрал филлер «Для тебя», не отменяет вкусового сигнала для карточки.
    const genuine = await selectTrackIdsByTaste([mood], []);
    if (!hasEnoughTracksForPersonalPlaylist(genuine.length)) continue;
    const trackIds = genuine.filter((id) => !exclude.has(id));
    const fullTrackIds = fillToLimit(trackIds, pool, exclude);
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
}
