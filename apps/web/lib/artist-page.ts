import { cache } from 'react';
import { db, DrizzleArtistReadRepository, artistHasPublishedTrackById } from '@vire/db';
import { ArtistPageService, type ArtistPageView, type IArtistReadRepository, type ArtistProfile } from '@vire/core';
import { auth } from '@/auth';

// Гейт сегмента (layout) и агрегат экрана читают профиль и признак пустоты через один кэш —
// иначе одни и те же два запроса уходят в БД дважды за рендер.
export const findArtistBySlug = cache(async (slug: string): Promise<ArtistProfile | null> =>
  new DrizzleArtistReadRepository(db).findBySlug(slug));

export const artistHasPublishedTrack = cache(async (artistId: string): Promise<boolean> =>
  artistHasPublishedTrackById(artistId));

function cachedRepository(): IArtistReadRepository {
  const base = new DrizzleArtistReadRepository(db);
  return {
    findBySlug: findArtistBySlug,
    hasPublishedTrack: artistHasPublishedTrack,
    isMember: (artistId, userId) => base.isMember(artistId, userId),
    listPublishedReleases: (artistId) => base.listPublishedReleases(artistId),
    listUpcoming: (artistId) => base.listUpcoming(artistId),
    listPosts: (artistId, limit) => base.listPosts(artistId, limit),
    listSmartLinks: (artistId) => base.listSmartLinks(artistId),
    listPlayableTracks: (artistId) => base.listPlayableTracks(artistId),
    explicitReleaseIds: (releaseIds) => base.explicitReleaseIds(releaseIds),
    followerCount: (artistId) => base.followerCount(artistId),
    isFollowing: (userId, artistId) => base.isFollowing(userId, artistId),
    presavedReleaseIds: (userId, releaseIds) => base.presavedReleaseIds(userId, releaseIds),
  };
}

export const getArtistPage = cache(async (slug: string): Promise<ArtistPageView | null> => {
  const session = await auth();
  const result = await new ArtistPageService(cachedRepository()).getPage({
    slug,
    viewerId: session?.user?.id ?? null,
    viewerRole: session?.user?.role ?? null,
  });
  return result.ok ? result.value : null;
});
