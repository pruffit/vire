import { ImageResponse } from 'next/og';
import { db, DrizzleArtistRepository, getSmartLinkBySlug, getSmartLinkRelease } from '@vire/db';
import { ArtistService } from '@vire/core';
import { SITE_NAME } from '@/lib/site';
import { ogCard, ogFallbackCard, OG_SIZE, OG_CACHE_HEADERS } from '@/lib/og/card';
import { fetchCoverThumb } from '@/lib/og/cover';

export const runtime = 'nodejs';
export const alt = `Смартлинк на ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 300;

export default async function SmartLinkOgImage({
  params,
}: {
  params: Promise<{ artistSlug: string; linkSlug: string }>;
}) {
  const { artistSlug, linkSlug } = await params;
  const artistResult = await new ArtistService(new DrizzleArtistRepository(db), { now: () => Date.now() }).getBySlug(artistSlug);
  if (!artistResult.ok) return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });

  const artist = artistResult.value;
  const smartLink = await getSmartLinkBySlug(artist.id, linkSlug);
  // черновик — как страница: только опубликованный лендинг отдаёт данные.
  if (!smartLink || !smartLink.isPublished) return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });

  const release = smartLink.releaseId ? await getSmartLinkRelease(smartLink.releaseId) : null;
  const display = {
    title: smartLink.title || release?.title || '',
    coverUrl: smartLink.coverUrl ?? release?.coverUrl ?? null,
  };
  const cover = await fetchCoverThumb(display.coverUrl);

  return new ImageResponse(
    ogCard({ kind: 'СМАРТЛИНК', title: display.title, subtitle: smartLink.subtitle ?? artist.name, cover }),
    { ...size, headers: OG_CACHE_HEADERS },
  );
}
