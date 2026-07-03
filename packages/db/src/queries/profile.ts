import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { likes, follows, tracks, releases, artistProfiles, users } from '../schema';

export async function getUserCreatedAt(userId: string): Promise<Date | null> {
  const rows = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.createdAt ?? null;
}

/**
 * Актуальные имя/аватар/дата из БД. Нужно потому что при JWT-стратегии сессия
 * не перечитывает users — после смены имени/фото токен остаётся устаревшим.
 */
export async function getUserProfile(
  userId: string,
): Promise<{ name: string | null; image: string | null; createdAt: Date | null } | null> {
  const [row] = await db
    .select({ name: users.name, image: users.image, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function updateUserName(userId: string, name: string): Promise<void> {
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserImage(userId: string, image: string | null): Promise<void> {
  await db.update(users).set({ image, updatedAt: new Date() }).where(eq(users.id, userId));
}

export interface LikedTrack {
  id: string;
  title: string;
  durationSec: number | null;
  releaseId: string;
  releaseCoverUrl: string | null;
  artistName: string;
  artistSlug: string;
  accentColor: string | null;
  isExplicit: boolean;
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
      accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
      isExplicit: tracks.isExplicit,
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
