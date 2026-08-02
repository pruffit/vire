import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../client';
import { likes, follows, tracks, releases, artistProfiles, users } from '../schema';
import { featFromCredits } from './track-credits';

export async function getUserCreatedAt(userId: string): Promise<Date | null> {
  const rows = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
  return rows[0]?.createdAt ?? null;
}

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
  version: string | null;
  feat: string[];
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
      version: tracks.version,
      credits: tracks.credits,
    })
    .from(likes)
    .innerJoin(tracks, eq(tracks.id, likes.trackId))
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(eq(likes.userId, userId))
    .orderBy(desc(likes.createdAt))
    .limit(100);

  return rows.map(({ credits, ...r }) => ({ ...r, feat: featFromCredits(credits) }));
}

export async function getUserPublicProfile(userId: string): Promise<{
  id: string;
  name: string | null;
  image: string | null;
  socialVisibility: 'FRIENDS' | 'PRIVATE';
  discoverable: boolean;
  notifyEmail: boolean;
} | null> {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      socialVisibility: users.socialVisibility,
      discoverable: users.discoverable,
      notifyEmail: users.notifyEmail,
    })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function updateUserSocialVisibility(userId: string, v: 'FRIENDS' | 'PRIVATE'): Promise<void> {
  await db.update(users).set({ socialVisibility: v, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserDiscoverable(userId: string, value: boolean): Promise<void> {
  await db.update(users).set({ discoverable: value, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserNotifyEmail(userId: string, value: boolean): Promise<void> {
  await db.update(users).set({ notifyEmail: value, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserNotifyPush(userId: string, value: boolean): Promise<void> {
  await db.update(users).set({ notifyPush: value, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getUserLastfmUsername(userId: string): Promise<string | null> {
  const [row] = await db.select({ lastfmUsername: users.lastfmUsername }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.lastfmUsername ?? null;
}

export async function updateUserLastfmUsername(userId: string, username: string | null): Promise<void> {
  await db.update(users).set({ lastfmUsername: username, updatedAt: new Date() }).where(eq(users.id, userId));
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

export async function getUserNotifyContext(userId: string): Promise<{ email: string | null; name: string | null; notifyEmail: boolean; notifyPush: boolean } | null> {
  const [row] = await db.select({ email: users.email, name: users.name, notifyEmail: users.notifyEmail, notifyPush: users.notifyPush })
    .from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function getUserDisplayName(userId: string): Promise<string | null> {
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  return row?.name ?? null;
}
