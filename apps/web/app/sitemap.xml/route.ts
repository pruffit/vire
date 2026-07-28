import { NextResponse } from 'next/server';
import {
  countSitemapArtists,
  countSitemapReleases,
  countSitemapTracks,
  countSitemapSmartLinks,
  countSitemapPlaylists,
} from '@vire/db';
import { planShards, shardFileName, type ShardId } from '@/lib/sitemap';
import { renderSitemapIndex } from '@/lib/sitemap-xml';
import { SITE_URL } from '@/lib/site';

// force-dynamic: без него SITE_URL резолвится на сборке до AUTH_URL, sitemap уезжает на localhost
export const dynamic = 'force-dynamic';

export async function GET() {
  const shards = await loadShards();
  const xml = renderSitemapIndex(shards.map((shard) => ({ url: `${SITE_URL}/sitemaps/${shardFileName(shard)}` })));
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/xml' } });
}

async function loadShards(): Promise<ShardId[]> {
  try {
    const [artists, releases, tracks, smartlinks, playlists] = await Promise.all([
      countSitemapArtists(),
      countSitemapReleases(),
      countSitemapTracks(),
      countSitemapSmartLinks(),
      countSitemapPlaylists(),
    ]);
    return planShards({ artists, releases, tracks, smartlinks, playlists });
  } catch {
    // БД недоступна — индекс отдаёт хотя бы static.xml, а не 500.
    return planShards({ artists: 0, releases: 0, tracks: 0, smartlinks: 0, playlists: 0 });
  }
}
