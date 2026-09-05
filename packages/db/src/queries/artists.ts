import { count, eq, ilike, and, sql } from 'drizzle-orm';
import type { ArtistCard } from '@vire/core';
import { db } from '../client';
import { artistProfiles, releases, artistMembers } from '../schema';

export type ArtistListItem = ArtistCard;

// Артист виден слушателям только если у него есть хотя бы один трек в
// опубликованном релизе. Пустые профили скрываем из каталога, поиска и sitemap.
// BLOCKED и FAILED не считаются: они не транзиентны, и артист с одним таким треком
// висел бы в витрине с пустой страницей. PROCESSING оставлен — это минуты транскодинга,
// а artist-guard отдаёт 404 артисту без треков, и свежеопубликованный не должен его ловить.
export const artistHasPublishedTrack = sql`exists (
  select 1 from tracks t
  join releases r on r.id = t.release_id
  where r.artist_profile_id = artist_profiles.id
    and r.status = 'PUBLISHED'
    and t.status not in ('BLOCKED', 'FAILED')
)`;

export async function listActiveArtists({
  query,
  limit = 200,
  offset = 0,
}: {
  query?: string | null;
  limit?: number;
  offset?: number;
} = {}): Promise<ArtistListItem[]> {
  // Запрос приходит из публичного роута: без экранирования `%`/`_` поиск по «%» совпал бы со всеми.
  const pattern = query ? `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;

  const rows = await db
    .select({
      id: artistProfiles.id,
      slug: artistProfiles.slug,
      name: artistProfiles.name,
      bio: artistProfiles.bio,
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
      releaseCount: count(releases.id),
      genres: sql<string[]>`coalesce(array_agg(distinct ${releases.genre}::text) filter (where ${releases.genre} is not null), '{}')`,
    })
    .from(artistProfiles)
    .leftJoin(
      releases,
      and(
        eq(releases.artistProfileId, artistProfiles.id),
        eq(releases.status, 'PUBLISHED'),
      ),
    )
    .where(
      pattern
        ? and(eq(artistProfiles.isActive, true), artistHasPublishedTrack, ilike(artistProfiles.name, pattern))
        : and(eq(artistProfiles.isActive, true), artistHasPublishedTrack),
    )
    .groupBy(
      artistProfiles.id,
      artistProfiles.slug,
      artistProfiles.name,
      artistProfiles.bio,
      artistProfiles.avatarUrl,
      artistProfiles.verified,
    )
    .orderBy(sql`lower(${artistProfiles.name})`, artistProfiles.id)
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    ...r,
    firstReleaseCoverUrl: r.firstReleaseCoverUrl ?? null,
    releaseCount: Number(r.releaseCount),
    genres: r.genres ?? [],
  }));
}

export async function artistHasPublishedTrackById(artistProfileId: string): Promise<boolean> {
  const [row] = await db
    .select({ has: sql<boolean>`${artistHasPublishedTrack}` })
    .from(artistProfiles)
    .where(eq(artistProfiles.id, artistProfileId))
    .limit(1);
  return row?.has ?? false;
}

export interface ArtistContextInfo {
  slug: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  /** Акцент темы артиста — плеер красит им фон и главную кнопку. */
  accentColor: string | null;
}

/** Артист трека для плеера (эндпоинт /tracks/[id]/context) — минимум для «Об авторе». */
export async function getArtistContext(artistProfileId: string): Promise<ArtistContextInfo | null> {
  const [row] = await db
    .select({
      slug: artistProfiles.slug,
      name: artistProfiles.name,
      avatarUrl: artistProfiles.avatarUrl,
      bio: artistProfiles.bio,
      accentColor: sql<string | null>`${artistProfiles.themeTokens}->>'accent'`,
    })
    .from(artistProfiles)
    .where(and(eq(artistProfiles.id, artistProfileId), eq(artistProfiles.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function isArtistMember(artistProfileId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: artistMembers.id })
    .from(artistMembers)
    .where(and(eq(artistMembers.artistProfileId, artistProfileId), eq(artistMembers.userId, userId)))
    .limit(1);
  return Boolean(row);
}
