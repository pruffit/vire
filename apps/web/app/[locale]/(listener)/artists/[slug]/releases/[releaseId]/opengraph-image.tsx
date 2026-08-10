import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { ArtistService, ReleaseService, isReleasePubliclyVisible } from '@vire/core';
import { SITE_NAME } from '@/lib/site';
import { releaseYear } from '@/lib/format';
import { ogCard, ogFallbackCard, OG_SIZE, OG_CACHE_HEADERS } from '@/lib/og/card';
import { fetchCoverThumb } from '@/lib/og/cover';

export const runtime = 'nodejs';
export const alt = `Релиз на ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 300;

export default async function ReleaseOgImage({ params }: { params: Promise<{ slug: string; releaseId: string }> }) {
  const { slug, releaseId } = await params;
  const [artistResult, releaseResult] = await Promise.all([
    new ArtistService(new DrizzleArtistRepository(db), { now: () => Date.now() }).getBySlug(slug),
    new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() }).getWithTracks(releaseId),
  ]);

  if (!artistResult.ok || !releaseResult.ok) return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });

  const artist = artistResult.value;
  const { release } = releaseResult.value;
  // OG-роут публичный и сессии не видит — черновик/архив/будущий SCHEDULED не отдают данные.
  if (release.artistProfileId !== artist.id || !isReleasePubliclyVisible(release, new Date())) {
    return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });
  }

  const cover = await fetchCoverThumb(release.coverUrl);
  const year = releaseYear(release.releaseDate);
  const t = await getTranslations('seo.og');

  return new ImageResponse(
    ogCard({
      kind: t('kind.release'),
      title: release.title,
      subtitle: year ? `${artist.name} · ${year}` : artist.name,
      cover,
    }),
    { ...size, headers: OG_CACHE_HEADERS },
  );
}
