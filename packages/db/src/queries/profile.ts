import { desc, eq } from 'drizzle-orm';
import { db } from '../client';
import { likes, follows, tracks, releases, artistProfiles } from '../schema';

export interface LikedTrack {
  id: string;
  title: string;
  durationSec: number | null;
  releaseId: string;
  releaseCoverUrl: string | null;
  artistName: string;
  artistSlug: string;
  likedAt: Date;
}

export interface FollowedArtist {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
  followedAt: Date;
}

export async function getLikedTracks(userId: string): Promise<LikedTrack[]> {
  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      durationSec: tracks.durationSec,
      releaseId: releases.id,
      releaseCoverUrl: releases.coverUrl,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      likedAt: likes.createdAt,
    })
    .from(likes)
    .innerJoin(tracks, eq(tracks.id, likes.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(eq(likes.userId, userId))
    .orderBy(desc(likes.createdAt))
    .limit(100);

  return rows;
}

export async function getFollowedArtists(userId: string): Promise<FollowedArtist[]> {
  const rows = await db
    .select({
      id: artistProfiles.id,
      slug: artistProfiles.slug,
      name: artistProfiles.name,
      avatarUrl: artistProfiles.avatarUrl,
      verified: artistProfiles.verified,
      followedAt: follows.createdAt,
    })
    .from(follows)
    .innerJoin(artistProfiles, eq(artistProfiles.id, follows.artistProfileId))
    .where(eq(follows.userId, userId))
    .orderBy(desc(follows.createdAt));

  return rows;
}
