import { and, desc, eq, or, lte, isNotNull, sql } from 'drizzle-orm';
import { db } from '../client';
import { follows, artistProfiles, releases } from '../schema';

export interface FeedRelease {
  id: string;
  title: string;
  type: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  artistName: string;
  artistSlug: string;
  artistAvatarUrl: string | null;
  hasExplicit: boolean;
}

export async function getFeed(userId: string): Promise<FeedRelease[]> {
  const rows = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      coverUrl: releases.coverUrl,
      releaseDate: releases.releaseDate,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      artistAvatarUrl: artistProfiles.avatarUrl,
      // Любой трек релиза explicit (см. discovery.releaseCardColumns).
      hasExplicit: sql<boolean>`exists (select 1 from "tracks" t where t.release_id = "releases".id and t.is_explicit)`,
    })
    .from(follows)
    .innerJoin(artistProfiles, eq(artistProfiles.id, follows.artistProfileId))
    .innerJoin(releases, eq(releases.artistProfileId, artistProfiles.id))
    .where(
      and(
        eq(follows.userId, userId),
        or(
          eq(releases.status, 'PUBLISHED'),
          and(
            eq(releases.status, 'SCHEDULED'),
            isNotNull(releases.releaseDate),
            lte(releases.releaseDate, sql`now()`),
          ),
        ),
      ),
    )
    // Свежесть = момент выхода в эфир (см. getLatestReleases).
    .orderBy(desc(sql`coalesce(${releases.publishedAt}, ${releases.releaseDate}, ${releases.createdAt})`))
    .limit(50);

  return rows;
}
