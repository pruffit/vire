import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';
import { getPlaylistWithTracks, getUserProfile } from '@vire/db';
import { SITE_NAME } from '@/lib/site';
import { ogCard, ogFallbackCard, OG_SIZE, OG_CACHE_HEADERS } from '@/lib/og/card';
import { fetchCoverThumb } from '@/lib/og/cover';
import { editorialPlaylistText } from '@/lib/editorial-playlist';
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
  const tPlaylist = await getTranslations('playlist');
  const tMoods = await getTranslations('moods');
  const tCommon = await getTranslations('common');
  const tSeo = await getTranslations('seo.og');
  const { title } = editorialPlaylistText(
    tPlaylist, tMoods, playlist.kind, playlist.editorialParams,
    { title: playlist.title, description: playlist.description },
  );

  return new ImageResponse(
    ogCard({
      kind: tSeo('kind.playlist'),
      title,
      subtitle: `${authorName} · ${tCommon('trackCount', { count })}`,
      cover,
    }),
    { ...size, headers: OG_CACHE_HEADERS },
  );
}
