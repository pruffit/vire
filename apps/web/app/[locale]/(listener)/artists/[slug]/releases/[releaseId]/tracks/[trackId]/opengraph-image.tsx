import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { db, DrizzleArtistRepository, DrizzleReleaseRepository } from '@vire/db';
import { ArtistService, ReleaseService, isReleasePubliclyVisible } from '@vire/core';
import { SITE_NAME } from '@/lib/site';
import { displayTrackTitle } from '@/lib/track-display';
import { ogCard, ogFallbackCard, OG_SIZE, OG_CACHE_HEADERS } from '@/lib/og/card';
import { fetchCoverThumb } from '@/lib/og/cover';

export const runtime = 'nodejs';
export const alt = `Трек на ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 300;

export default async function TrackOgImage({
  params,
}: {
  params: Promise<{ slug: string; releaseId: string; trackId: string }>;
}) {
  const { slug, releaseId, trackId } = await params;
  const [artistResult, releaseResult] = await Promise.all([
    new ArtistService(new DrizzleArtistRepository(db), { now: () => Date.now() }).getBySlug(slug),
    new ReleaseService(new DrizzleReleaseRepository(db), { uuid: () => crypto.randomUUID() }).getWithTracks(releaseId),
  ]);

  if (!artistResult.ok || !releaseResult.ok) return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });

  const artist = artistResult.value;
  const { release, tracks } = releaseResult.value;
  // трек неопубликованного релиза публично не существует — так же, как страница трека.
  if (release.artistProfileId !== artist.id || !isReleasePubliclyVisible(release, new Date())) {
    return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });
  }

  const track = tracks.find((t) => t.id === trackId);
  if (!track) return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });

  const cover = await fetchCoverThumb(release.coverUrl);
  const fullTitle = displayTrackTitle(track.title, { version: track.version, credits: track.credits });
  const t = await getTranslations('seo.og');

  return new ImageResponse(
    ogCard({ kind: t('kind.track'), title: fullTitle, subtitle: `${release.title} · ${artist.name}`, cover }),
    { ...size, headers: OG_CACHE_HEADERS },
  );
}
