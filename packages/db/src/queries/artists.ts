import { count, eq, ilike, and, sql } from 'drizzle-orm';
import { db } from '../client';
import { artistProfiles, releases } from '../schema';

export interface ArtistListItem {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  /** Обложка первого опубликованного релиза — fallback-аватар когда avatarUrl null. */
  firstReleaseCoverUrl: string | null;
  verified: boolean;
  releaseCount: number;
  // Жанры артиста — distinct по жанрам его опубликованных релизов (для фильтра в каталоге)
  genres: string[];
}

// Артист виден слушателям только если у него есть хотя бы один трек в
// опубликованном релизе. Пустые профили (зарегистрировался, но ничего не залил)
// скрываем из каталога, поиска и sitemap. Внешнюю таблицу адресуем ЛИТЕРАЛОМ
// `artist_profiles.id`, а не `${artistProfiles.id}`: интерполяция колонки в
// коррелированный sql-подзапрос даёт неквалифицированное имя (см. CLAUDE.md).
const artistHasPublishedTrack = sql`exists (
  select 1 from tracks t
  join releases r on r.id = t.release_id
  where r.artist_profile_id = artist_profiles.id
    and r.status = 'PUBLISHED'
)`;

export async function listActiveArtists(query?: string): Promise<ArtistListItem[]> {
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
      query
        ? and(eq(artistProfiles.isActive, true), artistHasPublishedTrack, ilike(artistProfiles.name, `%${query}%`))
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
    .orderBy(sql`lower(${artistProfiles.name})`);

  return rows.map((r) => ({
    ...r,
    firstReleaseCoverUrl: r.firstReleaseCoverUrl ?? null,
    releaseCount: Number(r.releaseCount),
    genres: r.genres ?? [],
  }));
}
