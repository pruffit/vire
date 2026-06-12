import { count, eq, ilike, and, sql } from 'drizzle-orm';
import { db } from '../client';
import { artistProfiles, releases } from '../schema';

export interface ArtistListItem {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  verified: boolean;
  releaseCount: number;
  // Жанры артиста — distinct по жанрам его опубликованных релизов (для фильтра в каталоге)
  genres: string[];
}

export async function listActiveArtists(query?: string): Promise<ArtistListItem[]> {
  const rows = await db
    .select({
      id: artistProfiles.id,
      slug: artistProfiles.slug,
      name: artistProfiles.name,
      bio: artistProfiles.bio,
      avatarUrl: artistProfiles.avatarUrl,
      verified: artistProfiles.verified,
      releaseCount: count(releases.id),
      genres: sql<string[]>`coalesce(array_agg(distinct ${releases.genre}::text) filter (where ${releases.genre} is not null), '{}')`,
    })
    .from(artistProfiles)
    .leftJoin(
      releases,
      and(
        eq(releases.artistProfileId, artistProfiles.id),
        eq(releases.status, 'PUBLISHED'),
      ),
    )
    .where(
      query
        ? and(eq(artistProfiles.isActive, true), ilike(artistProfiles.name, `%${query}%`))
        : eq(artistProfiles.isActive, true),
    )
    .groupBy(
      artistProfiles.id,
      artistProfiles.slug,
      artistProfiles.name,
      artistProfiles.bio,
      artistProfiles.avatarUrl,
      artistProfiles.verified,
    )
    .orderBy(sql`lower(${artistProfiles.name})`);

  return rows.map((r) => ({
    ...r,
    releaseCount: Number(r.releaseCount),
    genres: r.genres ?? [],
  }));
}
