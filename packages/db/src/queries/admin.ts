import { and, asc, count, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { users, artistProfiles, releases, tracks } from '../schema';
import type { UserRole } from './admin-types';

export type { UserRole };

export interface AdminStats {
  totalUsers: number;
  totalArtists: number;
  totalTracks: number;
  totalReleases: number;
  tracksProcessing: number;
  tracksReady: number;
  tracksBlocked: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  const [[userCount], [artistCount], trackCounts, [releaseCount]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(artistProfiles),
    db.select({ status: tracks.status, n: count() }).from(tracks).groupBy(tracks.status),
    db.select({ n: count() }).from(releases),
  ]);

  const byStatus = Object.fromEntries(trackCounts.map((r) => [r.status, Number(r.n)]));

  return {
    totalUsers: Number(userCount?.n ?? 0),
    totalArtists: Number(artistCount?.n ?? 0),
    totalTracks: trackCounts.reduce((s, r) => s + Number(r.n), 0),
    totalReleases: Number(releaseCount?.n ?? 0),
    tracksProcessing: byStatus['PROCESSING'] ?? 0,
    tracksReady: byStatus['READY'] ?? 0,
    tracksBlocked: byStatus['BLOCKED'] ?? 0,
  };
}

// ─── Attention items ───────────────────────────────────────────────────────

export interface StuckTrack {
  id: string;
  title: string;
  releaseTitle: string;
  artistSlug: string;
  releaseId: string;
  updatedAt: Date;
}

export interface UnverifiedArtist {
  profileId: string;
  name: string;
  slug: string;
  publishedCount: number;
}

export interface AdminAttention {
  stuckTracks: StuckTrack[];
  blockedTracksCount: number;
  unverifiedArtists: UnverifiedArtist[];
}

export async function getAdminAttention(): Promise<AdminAttention> {
  const [stuckRows, [blockedRow], unverifiedRows] = await Promise.all([
    // Треки, которые зависли в PROCESSING больше 2 часов
    db
      .select({
        id: tracks.id,
        title: tracks.title,
        releaseTitle: releases.title,
        artistSlug: artistProfiles.slug,
        releaseId: releases.id,
        updatedAt: tracks.updatedAt,
      })
      .from(tracks)
      .innerJoin(releases, eq(releases.id, tracks.releaseId))
      .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
      .where(
        and(
          eq(tracks.status, 'PROCESSING'),
          lt(tracks.updatedAt, sql`now() - interval '2 hours'`),
        ),
      )
      .orderBy(asc(tracks.updatedAt))
      .limit(10),

    // Количество заблокированных треков
    db.select({ n: count() }).from(tracks).where(eq(tracks.status, 'BLOCKED')),

    // Артисты с опубликованными релизами, но без верификации
    db
      .select({
        profileId: artistProfiles.id,
        name: artistProfiles.name,
        slug: artistProfiles.slug,
        publishedCount: count(releases.id),
      })
      .from(artistProfiles)
      .innerJoin(
        releases,
        and(
          eq(releases.artistProfileId, artistProfiles.id),
          eq(releases.status, 'PUBLISHED'),
        ),
      )
      .where(eq(artistProfiles.verified, false))
      .groupBy(artistProfiles.id, artistProfiles.name, artistProfiles.slug)
      .orderBy(desc(count(releases.id)))
      .limit(5),
  ]);

  return {
    stuckTracks: stuckRows,
    blockedTracksCount: Number(blockedRow?.n ?? 0),
    unverifiedArtists: unverifiedRows.map((r) => ({
      ...r,
      publishedCount: Number(r.publishedCount),
    })),
  };
}

// ─── Recent activity ───────────────────────────────────────────────────────

export interface AdminRecentRelease {
  id: string;
  title: string;
  type: string;
  artistName: string;
  artistSlug: string;
  updatedAt: Date;
}

export async function getRecentPublishedReleases(limit = 8): Promise<AdminRecentRelease[]> {
  return db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      updatedAt: releases.updatedAt,
    })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(eq(releases.status, 'PUBLISHED'))
    .orderBy(desc(releases.updatedAt))
    .limit(limit);
}

// ─── Users ─────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: string;
  createdAt: Date;
  artistSlug: string | null;
  artistVerified: boolean | null;
  artistProfileId: string | null;
}

export async function listUsersAdmin(opts: {
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminUser[]> {
  const { search, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      artistSlug: artistProfiles.slug,
      artistVerified: artistProfiles.verified,
      artistProfileId: artistProfiles.id,
    })
    .from(users)
    .leftJoin(artistProfiles, eq(artistProfiles.userId, users.id))
    .where(
      search
        ? or(
            ilike(users.email, `%${search}%`),
            ilike(users.name, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function verifyArtist(artistProfileId: string, verified: boolean): Promise<void> {
  await db
    .update(artistProfiles)
    .set({ verified, updatedAt: new Date() })
    .where(eq(artistProfiles.id, artistProfileId));
}

// ─── Tracks ────────────────────────────────────────────────────────────────

export interface AdminTrack {
  id: string;
  title: string;
  status: string;
  trackNumber: number;
  createdAt: Date;
  releaseTitle: string;
  releaseId: string;
  artistName: string;
  artistSlug: string;
}

export async function listTracksAdmin(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminTrack[]> {
  const { status, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      status: tracks.status,
      trackNumber: tracks.trackNumber,
      createdAt: tracks.createdAt,
      releaseTitle: releases.title,
      releaseId: releases.id,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(status ? eq(tracks.status, status as 'PROCESSING' | 'READY' | 'BLOCKED') : undefined)
    .orderBy(desc(tracks.createdAt))
    .limit(limit)
    .offset(offset);

  return rows;
}

export async function setTrackStatus(
  trackId: string,
  status: 'READY' | 'BLOCKED' | 'PROCESSING',
): Promise<void> {
  await db.update(tracks).set({ status, updatedAt: new Date() }).where(eq(tracks.id, trackId));
}

// ─── Releases ──────────────────────────────────────────────────────────────

export interface AdminRelease {
  id: string;
  title: string;
  type: string;
  status: string;
  createdAt: Date;
  releaseDate: Date | null;
  artistName: string;
  artistSlug: string;
  trackCount: number;
}

export async function listReleasesAdmin(opts: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<AdminRelease[]> {
  const { status, limit = 50, offset = 0 } = opts;

  const rows = await db
    .select({
      id: releases.id,
      title: releases.title,
      type: releases.type,
      status: releases.status,
      createdAt: releases.createdAt,
      releaseDate: releases.releaseDate,
      artistName: artistProfiles.name,
      artistSlug: artistProfiles.slug,
      trackCount: count(tracks.id),
    })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .leftJoin(tracks, eq(tracks.releaseId, releases.id))
    .where(
      status
        ? eq(releases.status, status as 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED')
        : undefined,
    )
    .groupBy(releases.id, artistProfiles.name, artistProfiles.slug)
    .orderBy(desc(releases.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({ ...r, trackCount: Number(r.trackCount) }));
}

export async function setReleaseStatus(
  releaseId: string,
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
): Promise<void> {
  await db.update(releases).set({ status, updatedAt: new Date() }).where(eq(releases.id, releaseId));
}
