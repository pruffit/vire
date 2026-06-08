import { and, asc, desc, eq, gt, isNotNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { artistProfiles, releases } from '../schema';

export interface DiscoveryRelease {
  id: string;
  title: string;
  type: string;
  coverUrl: string | null;
  releaseDate: Date | null;
  artistName: string;
  artistSlug: string;
  artistAvatarUrl: string | null;
}

const releaseCardColumns = {
  id: releases.id,
  title: releases.title,
  type: releases.type,
  coverUrl: releases.coverUrl,
  releaseDate: releases.releaseDate,
  artistName: artistProfiles.name,
  artistSlug: artistProfiles.slug,
  artistAvatarUrl: artistProfiles.avatarUrl,
};

/** Свежие релизы по всей платформе (опубликованные / запланированные с прошедшей датой). */
export async function getLatestReleases(limit = 12): Promise<DiscoveryRelease[]> {
  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(artistProfiles.isActive, true),
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
    .orderBy(desc(sql`coalesce(${releases.releaseDate}, ${releases.createdAt})`))
    .limit(limit);
}

/** Грядущие релизы: запланированы с датой в будущем («скоро выйдет»). */
export async function getUpcomingReleases(limit = 8): Promise<DiscoveryRelease[]> {
  return db
    .select(releaseCardColumns)
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(
      and(
        eq(artistProfiles.isActive, true),
        eq(releases.status, 'SCHEDULED'),
        isNotNull(releases.releaseDate),
        gt(releases.releaseDate, sql`now()`),
      ),
    )
    .orderBy(asc(releases.releaseDate))
    .limit(limit);
}
