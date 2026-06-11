import { desc, eq, gte, sql, and, count } from 'drizzle-orm';
import { db } from '../client';
import { tracks, releases, trackMoods, playEvents } from '../schema';
import { upsertEditorialPlaylist } from './playlists';
import { ALL_MOODS, MOOD_LABELS, type Mood } from './track-moods';

/**
 * Генерирует все редакционные плейлисты.
 * Вызывается по крону (воркер) или вручную из /api/v1/admin/editorial.
 */
export async function generateAllEditorialPlaylists(): Promise<void> {
  await Promise.all([
    generateTrendingPlaylist(),
    generateRelistenPlaylist(),
    generateFreshPlaylist(),
    ...ALL_MOODS.map((mood) => generateMoodPlaylist(mood)),
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
    .limit(25);

  if (rows.length < 3) return; // не генерируем без данных

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
        sql`${playEvents.userId} IS NOT NULL`,
        gte(playEvents.startedAt, sql`now() - interval '30 days'`),
      ),
    )
    .groupBy(playEvents.trackId)
    .having(sql`COUNT(DISTINCT DATE(${playEvents.startedAt})) >= 2`)
    .orderBy(desc(sql`COUNT(DISTINCT DATE(${playEvents.startedAt}))`))
    .limit(25);

  if (rows.length < 3) return;

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
    .where(eq(tracks.status, 'READY'))
    .orderBy(desc(releases.releaseDate))
    .limit(25);

  if (rows.length < 3) return;

  await upsertEditorialPlaylist({
    kind: 'FRESH',
    title: 'Свежее',
    description: 'Только что опубликованные треки',
    trackIds: rows.map((r) => r.id),
  });
}

/** Подборка по mood-тегу. Только для mood с ≥3 тегированными треками. */
async function generateMoodPlaylist(mood: Mood): Promise<void> {
  const rows = await db
    .select({ trackId: trackMoods.trackId })
    .from(trackMoods)
    .innerJoin(tracks, eq(tracks.id, trackMoods.trackId))
    .where(and(eq(trackMoods.mood, mood), eq(tracks.status, 'READY')))
    .limit(25);

  if (rows.length < 3) return;

  await upsertEditorialPlaylist({
    kind: 'MOOD',
    title: MOOD_LABELS[mood],
    description: `Подборка треков в настроении «${MOOD_LABELS[mood]}»`,
    trackIds: rows.map((r) => r.trackId),
  });
}
