import { and, eq, ilike, or } from 'drizzle-orm';
import { db } from '../client';
import { artistProfiles, releases, tracks } from '../schema';

export interface SearchArtist {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
}

export interface SearchRelease {
  id: string;
  title: string;
  type: string;
  genre: string | null;
  coverUrl: string | null;
  artistSlug: string;
  artistName: string;
}

export interface SearchTrack {
  id: string;
  title: string;
  releaseId: string;
  artistSlug: string;
  artistName: string;
  coverUrl: string | null;
}

export interface SearchResults {
  artists: SearchArtist[];
  releases: SearchRelease[];
  tracks: SearchTrack[];
}

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
        verified: artistProfiles.verified,
      })
      .from(artistProfiles)
      .where(and(eq(artistProfiles.isActive, true), ilike(artistProfiles.name, q)))
      .limit(limit),

    db
      .select({
        id: releases.id,
        title: releases.title,
        type: releases.type,
        genre: releases.genre,
        coverUrl: releases.coverUrl,
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
      })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(and(eq(tracks.status, 'READY'), ilike(tracks.title, q)))
      .limit(limit),
  ]);

  return { artists: artistRows, releases: releaseRows, tracks: trackRows };
}
