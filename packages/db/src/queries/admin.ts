import { and, asc, count, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import { db } from '../client';
import {
  users, artistProfiles, artistMembers, releases, tracks, trackAudio, playEvents,
  likes, follows, playlists, playlistTracks, artistPosts, trackMoods, favoriteMoments,
  rightsHolders,
} from '../schema';
import type { UserRole } from './admin-types';
import { defaultThemeTokens, type ThemeTokens } from '@vire/core';

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

/** Пинг базы: латентность в мс или null при недоступности (для health-панели админки). */
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
  failedTracks: StuckTrack[];
  blockedTracksCount: number;
  unverifiedArtists: UnverifiedArtist[];
}

export async function getAdminAttention(): Promise<AdminAttention> {
  const [stuckRows, failedRows, [blockedRow], unverifiedRows] = await Promise.all([
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

    // Артист уже уведомлён о FAILED письмом, но админу стоит видеть для разбора.
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
      .where(eq(tracks.status, 'FAILED'))
      .orderBy(desc(tracks.updatedAt))
      .limit(10),

    db.select({ n: count() }).from(tracks).where(eq(tracks.status, 'BLOCKED')),

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
    failedTracks: failedRows,
    blockedTracksCount: Number(blockedRow?.n ?? 0),
    unverifiedArtists: unverifiedRows.map((r) => ({
      ...r,
      publishedCount: Number(r.publishedCount),
    })),
  };
}

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

