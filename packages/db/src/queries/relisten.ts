import { desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../client';
import { playEvents, tracks, releases } from '../schema';

/** Возврат = слушатель (user_id, аноним: session_id) играл трек в 2+ разных дня; повтор внутри одной сессии не считается. */

export interface RelistenTrack {
  trackId: string;
  trackTitle: string;
  releaseTitle: string;
  distinctListeners: number;
  returningListeners: number;
}

export interface ArtistRelistenStats {
  tracks: RelistenTrack[];
  totalReturning: number;
}

export async function getArtistRelistenStats(
  artistProfileId: string,
): Promise<ArtistRelistenStats> {
  const identity = sql<string>`coalesce(${playEvents.userId}::text, ${playEvents.sessionId})`;

  // Для каждой пары (трек, слушатель): в скольких разных днях играл.
  const perIdentity = db
    .select({
      trackId: playEvents.trackId,
      identity: identity.as('identity'),
      days: sql<number>`count(distinct date(${playEvents.startedAt}))`.as('days'),
    })
    .from(playEvents)
    .innerJoin(tracks, eq(tracks.id, playEvents.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .where(eq(releases.artistProfileId, artistProfileId))
    .groupBy(playEvents.trackId, identity)
    .as('per_identity');

  const [trackRows, [agg]] = await Promise.all([
    // По трекам: всего слушателей и сколько из них вернулось.
    db
      .select({
        trackId: perIdentity.trackId,
        trackTitle: tracks.title,
        releaseTitle: releases.title,
        distinctListeners: sql<number>`count(*)::int`,
        returningListeners: sql<number>`(count(*) filter (where ${perIdentity.days} >= 2))::int`,
      })
      .from(perIdentity)
      .innerJoin(tracks, eq(tracks.id, perIdentity.trackId))
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .groupBy(perIdentity.trackId, tracks.title, releases.title)
      .orderBy(
        desc(sql`(count(*) filter (where ${perIdentity.days} >= 2))`),
        desc(sql`count(*)`),
      )
      .limit(8),

    // Уникальные вернувшиеся по всему каталогу артиста, без двойного счёта по трекам.
    db
      .select({ n: sql<number>`count(distinct ${perIdentity.identity})::int` })
      .from(perIdentity)
      .where(gte(perIdentity.days, 2)),
  ]);

  return {
    tracks: trackRows.map((r) => ({
      trackId: r.trackId,
      trackTitle: r.trackTitle,
      releaseTitle: r.releaseTitle,
      distinctListeners: Number(r.distinctListeners),
      returningListeners: Number(r.returningListeners),
    })),
    totalReturning: Number(agg?.n ?? 0),
  };
}
