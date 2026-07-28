import { and, asc, count, eq, isNotNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../client';
import { artistProfiles, releases, tracks, smartLinks, playlists } from '../schema';
import { artistHasPublishedTrack } from './artists';
import type { SitemapPlaylist } from './playlists';

export interface SitemapArtistRow {
  slug: string;
}

export interface SitemapReleaseRow {
  id: string;
  artistSlug: string;
  updatedAt: Date;
}

export interface SitemapTrackRow {
  id: string;
  releaseId: string;
  artistSlug: string;
  updatedAt: Date;
}

export interface SitemapSmartLinkRow {
  slug: string;
  artistSlug: string;
}

const visibleArtist = and(eq(artistProfiles.isActive, true), artistHasPublishedTrack);

// Тот же предикат, что listReleases/getLatestReleases в discovery.ts: опубликован
// или запланирован с уже наступившей датой. now() считается в SQL — Date не биндится.
const releaseAired = or(
  eq(releases.status, 'PUBLISHED'),
  and(eq(releases.status, 'SCHEDULED'), isNotNull(releases.releaseDate), lte(releases.releaseDate, sql`now()`)),
);

export async function countSitemapArtists(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(artistProfiles).where(visibleArtist);
  return Number(row?.n ?? 0);
}

export async function listSitemapArtists(limit: number, offset: number): Promise<SitemapArtistRow[]> {
  return db
    .select({ slug: artistProfiles.slug })
    .from(artistProfiles)
    .where(visibleArtist)
    .orderBy(asc(artistProfiles.id))
    .limit(limit)
    .offset(offset);
}

export async function countSitemapReleases(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(visibleArtist, releaseAired));
  return Number(row?.n ?? 0);
}

export async function listSitemapReleases(limit: number, offset: number): Promise<SitemapReleaseRow[]> {
  return db
    .select({ id: releases.id, artistSlug: artistProfiles.slug, updatedAt: releases.updatedAt })
    .from(releases)
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(visibleArtist, releaseAired))
    .orderBy(asc(releases.id))
    .limit(limit)
    .offset(offset);
}

export async function countSitemapTracks(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(visibleArtist, releaseAired));
  return Number(row?.n ?? 0);
}

export async function listSitemapTracks(limit: number, offset: number): Promise<SitemapTrackRow[]> {
  return db
    .select({
      id: tracks.id,
      releaseId: releases.id,
      artistSlug: artistProfiles.slug,
      updatedAt: releases.updatedAt,
    })
    .from(tracks)
    .innerJoin(releases, eq(releases.id, tracks.releaseId))
    .innerJoin(artistProfiles, eq(artistProfiles.id, releases.artistProfileId))
    .where(and(visibleArtist, releaseAired))
    .orderBy(asc(tracks.id))
    .limit(limit)
    .offset(offset);
}

export async function countSitemapSmartLinks(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(smartLinks)
    .innerJoin(artistProfiles, eq(artistProfiles.id, smartLinks.artistProfileId))
    .where(and(visibleArtist, eq(smartLinks.isPublished, true)));
  return Number(row?.n ?? 0);
}

export async function listSitemapSmartLinks(limit: number, offset: number): Promise<SitemapSmartLinkRow[]> {
  return db
    .select({ slug: smartLinks.slug, artistSlug: artistProfiles.slug })
    .from(smartLinks)
    .innerJoin(artistProfiles, eq(artistProfiles.id, smartLinks.artistProfileId))
    .where(and(visibleArtist, eq(smartLinks.isPublished, true)))
    .orderBy(asc(smartLinks.id))
    .limit(limit)
    .offset(offset);
}

// Editorial (перегенерируются ежедневно) и personal (под юзера) исключены умышленно.
const visiblePlaylist = and(
  eq(playlists.visibility, 'PUBLIC'),
  eq(playlists.kind, 'USER'),
  sql`exists (select 1 from playlist_tracks pt where pt.playlist_id = playlists.id)`,
);

export async function countSitemapPlaylists(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(playlists).where(visiblePlaylist);
  return Number(row?.n ?? 0);
}

export async function listSitemapPlaylists(limit: number, offset: number): Promise<SitemapPlaylist[]> {
  return db
    .select({ id: playlists.id, updatedAt: playlists.updatedAt })
    .from(playlists)
    .where(visiblePlaylist)
    .orderBy(asc(playlists.id))
    .limit(limit)
    .offset(offset);
}
