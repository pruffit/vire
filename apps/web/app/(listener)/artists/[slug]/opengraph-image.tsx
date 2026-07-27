import { ImageResponse } from 'next/og';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository, artistHasPublishedTrackById } from '@vire/db';
import { ArtistService, ReleaseService } from '@vire/core';
import { SITE_NAME } from '@/lib/site';
import { resolveAvatarUrl } from '@/lib/avatar';
import { ogCard, ogFallbackCard, OG_SIZE, OG_CACHE_HEADERS } from '@/lib/og/card';
import { fetchCoverThumb } from '@/lib/og/cover';

export const runtime = 'nodejs';
export const alt = `Артист на ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 300;

export default async function ArtistOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const artistResult = await new ArtistService(new DrizzleArtistRepository(db), { now: () => Date.now() }).getBySlug(slug);
  if (!artistResult.ok) return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });

  const artist = artistResult.value;
  // OG-роут публичный и сессии не видит — пустой артист скрыт с витрины: фолбэк без данных.
  if (!(await artistHasPublishedTrackById(artist.id))) {
    return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });
  }

  const releases = await new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() }).getPublishedByArtist(artist.id);
  const avatar = resolveAvatarUrl(artist.avatarUrl, releases[0]?.coverUrl ?? null);
  const cover = await fetchCoverThumb(avatar);

  return new ImageResponse(
    ogCard({ kind: 'АРТИСТ', title: artist.name, subtitle: artist.bio ?? 'Артист на Vire', cover }),
    { ...size, headers: OG_CACHE_HEADERS },
  );
}
