import { and, eq, ilike, or, sql } from 'drizzle-orm';
import type { SearchArtist, SearchRelease, SearchTrack, SearchResults } from '@vire/core';
import { db } from '../client';
import { artistProfiles, releases, tracks } from '../schema';
import { featFromCredits } from './track-credits';

export type { SearchArtist, SearchRelease, SearchTrack, SearchResults };

export async function searchAll(query: string, limit = 5): Promise<SearchResults> {
  if (!query.trim()) return { artists: [], releases: [], tracks: [] };

  const q = `%${query.trim()}%`;

  const [artistRows, releaseRows, trackRows] = await Promise.all([
    db
      .select({
        id: artistProfiles.id,
        slug: artistProfiles.slug,
        name: artistProfiles.name,
        avatarUrl: artistProfiles.avatarUrl,
        firstReleaseCoverUrl: sql<string | null>`(
          select cover_url from releases r2
          where r2.artist_profile_id = ${artistProfiles.id}
            and r2.status = 'PUBLISHED'
            and r2.cover_url is not null
          order by r2.created_at asc
          limit 1
        )`,
        verified: artistProfiles.verified,
      })
      .from(artistProfiles)
      // Только артисты с треком в опубликованном релизе: пустые профили в поиске не показываем.
      .where(
        and(
          eq(artistProfiles.isActive, true),
          sql`exists (
            select 1 from tracks t
            join releases r on r.id = t.release_id
            where r.artist_profile_id = artist_profiles.id
              and r.status = 'PUBLISHED'
          )`,
          ilike(artistProfiles.name, q),
        ),
      )
      .limit(limit),

    db
      .select({
        id: releases.id,
        title: releases.title,
        type: releases.type,
        genre: releases.genre,
        coverUrl: releases.coverUrl,
        status: releases.status,
        releaseDate: releases.releaseDate,
        artistSlug: artistProfiles.slug,
        artistName: artistProfiles.name,
      })
      .from(releases)
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(
        and(
          or(eq(releases.status, 'PUBLISHED'), eq(releases.status, 'SCHEDULED')),
          ilike(releases.title, q),
        ),
      )
      .limit(limit),

    db
      .select({
        id: tracks.id,
        title: tracks.title,
        releaseId: releases.id,
        artistSlug: artistProfiles.slug,
        artistName: artistProfiles.name,
        coverUrl: releases.coverUrl,
        version: tracks.version,
        credits: tracks.credits,
      })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(
        and(
          eq(tracks.status, 'READY'),
          eq(releases.status, 'PUBLISHED'),
          or(ilike(tracks.title, q), ilike(artistProfiles.name, q), ilike(releases.title, q)),
        ),
      )
      .limit(limit),
  ]);

  return {
    artists: artistRows,
    releases: releaseRows,
    tracks: trackRows.map(({ credits, ...r }) => ({ ...r, feat: featFromCredits(credits) })),
  };
}
