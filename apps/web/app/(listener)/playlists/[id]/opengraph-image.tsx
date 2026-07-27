import { ImageResponse } from 'next/og';
import { getPlaylistWithTracks, getUserProfile } from '@vire/db';
import { SITE_NAME } from '@/lib/site';
import { pluralTracks } from '@/lib/format';
import { ogCard, ogFallbackCard, OG_SIZE, OG_CACHE_HEADERS } from '@/lib/og/card';
import { fetchCoverThumb } from '@/lib/og/cover';
import { getHeaderCovers } from './header-cover';

export const runtime = 'nodejs';
export const alt = `Плейлист на ${SITE_NAME}`;
export const size = OG_SIZE;
export const contentType = 'image/png';
export const revalidate = 300;

export default async function PlaylistOgImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playlist = await getPlaylistWithTracks(id);

  // OG-роут публичный и сессии не видит: приватный плейлист не отдаёт ни названия, ни обложек.
  if (!playlist || playlist.visibility !== 'PUBLIC') {
    return new ImageResponse(ogFallbackCard(), { ...size, headers: OG_CACHE_HEADERS });
  }

  const covers = await Promise.all(getHeaderCovers(playlist).map((src) => fetchCoverThumb(src)));
  const cover = covers.filter((c): c is string => c !== null);
  const owner = playlist.ownerUserId ? await getUserProfile(playlist.ownerUserId) : null;
  const authorName = owner?.name ?? SITE_NAME;
  const count = playlist.tracks.length;

  return new ImageResponse(
    ogCard({
      kind: 'ПЛЕЙЛИСТ',
      title: playlist.title,
      subtitle: `${authorName} · ${count} ${pluralTracks(count)}`,
      cover,
    }),
    { ...size, headers: OG_CACHE_HEADERS },
  );
}
