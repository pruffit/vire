import { cache } from 'react';
import { db, DrizzleReleaseReadRepository } from '@vire/db';
import { ReleasePageService, type ReleasePageView, type IReleaseReadRepository } from '@vire/core';
import { auth } from '@/auth';
import { findArtistBySlug, artistHasPublishedTrack } from '@/lib/artist-page';

function cachedRepository(): IReleaseReadRepository {
  const base = new DrizzleReleaseReadRepository(db);
  return {
    findArtistBySlug,
    findArtistById: (id) => base.findArtistById(id),
    findReleaseWithTracks: (releaseId) => base.findReleaseWithTracks(releaseId),
    isPresaved: (userId, releaseId) => base.isPresaved(userId, releaseId),
    // Гейт сегмента (artist-guard) читает тот же признак — общий React cache() экономит запрос.
    hasPublishedTrack: artistHasPublishedTrack,
    isMember: (artistId, userId) => base.isMember(artistId, userId),
  };
}

export const getReleasePage = cache(async (slug: string, releaseId: string): Promise<ReleasePageView | null> => {
  const session = await auth();
  const result = await new ReleasePageService(cachedRepository(), Date.now).getPage({
    releaseId,
    artistSlug: slug,
    viewerId: session?.user?.id ?? null,
    viewerRole: session?.user?.role ?? null,
  });
  return result.ok ? result.value : null;
});
