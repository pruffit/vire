import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { likes, tracks, releases, artistProfiles, trackGenres } from '../schema';
import type { TrackGenre } from './track-genres';

export interface ListenerTaste {
  topGenres: { genre: TrackGenre; count: number }[];
  topArtists: {
    id: string;
    slug: string;
    name: string;
    avatarUrl: string | null;
    verified: boolean;
    likeCount: number;
  }[];
}

export async function getListenerTaste(userId: string): Promise<ListenerTaste> {
  const [topGenres, topArtists] = await Promise.all([
    db
      .select({ genre: trackGenres.genre, count: sql<number>`count(*)::int` })
      .from(likes)
      .innerJoin(trackGenres, eq(trackGenres.trackId, likes.trackId))
      .where(eq(likes.userId, userId))
      .groupBy(trackGenres.genre)
      .orderBy(desc(sql`count(*)`))
      .limit(6),
    db
      .select({
        id: artistProfiles.id,
        slug: artistProfiles.slug,
        name: artistProfiles.name,
        avatarUrl: artistProfiles.avatarUrl,
        verified: artistProfiles.verified,
        likeCount: sql<number>`count(*)::int`,
      })
      .from(likes)
      .innerJoin(tracks, eq(tracks.id, likes.trackId))
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(eq(likes.userId, userId))
      .groupBy(artistProfiles.id)
      .orderBy(desc(sql`count(*)`))
      .limit(10),
  ]);
  return { topGenres, topArtists };
}
