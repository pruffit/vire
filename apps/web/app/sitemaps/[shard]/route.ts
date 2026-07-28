import { NextResponse } from 'next/server';
import {
  listSitemapArtists,
  listSitemapReleases,
  listSitemapTracks,
  listSitemapSmartLinks,
  listSitemapPlaylists,
} from '@vire/db';
import { parseShardId, SITEMAP_PAGE_SIZE, type ShardId } from '@/lib/sitemap';
import { renderUrlSet, type SitemapUrl } from '@/lib/sitemap-xml';
import { SITE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ shard: string }> };

const STATIC_URLS: SitemapUrl[] = [
  // без слэша — Next в canonical корня безусловно отдаёт origin (resolve-url.js), сверяем с ним
  { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
  { url: `${SITE_URL}/artists`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${SITE_URL}/releases`, changeFrequency: 'daily', priority: 0.8 },
  { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.4 },
];

export async function GET(_req: Request, { params }: Ctx) {
  const { shard: raw } = await params;
  const shard = parseShardId(raw);
  if (!shard) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const urls = await loadUrls(shard);
  return new NextResponse(renderUrlSet(urls), { headers: { 'Content-Type': 'application/xml' } });
}

async function loadUrls(shard: ShardId): Promise<SitemapUrl[]> {
  if (shard.section === 'static') return STATIC_URLS;

  const offset = shard.page * SITEMAP_PAGE_SIZE;
  try {
    switch (shard.section) {
      case 'artists': {
        const rows = await listSitemapArtists(SITEMAP_PAGE_SIZE, offset);
        return rows.map((a) => ({ url: `${SITE_URL}/artists/${a.slug}`, changeFrequency: 'weekly', priority: 0.7 }));
      }
      case 'releases': {
        const rows = await listSitemapReleases(SITEMAP_PAGE_SIZE, offset);
        return rows.map((r) => ({
          url: `${SITE_URL}/artists/${r.artistSlug}/releases/${r.id}`,
          lastModified: r.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.6,
        }));
      }
      case 'tracks': {
        const rows = await listSitemapTracks(SITEMAP_PAGE_SIZE, offset);
        return rows.map((t) => ({
          url: `${SITE_URL}/artists/${t.artistSlug}/releases/${t.releaseId}/tracks/${t.id}`,
          lastModified: t.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.5,
        }));
      }
      case 'smartlinks': {
        const rows = await listSitemapSmartLinks(SITEMAP_PAGE_SIZE, offset);
        return rows.map((sl) => ({
          url: `${SITE_URL}/smartlink/${sl.artistSlug}/${sl.slug}`,
          changeFrequency: 'weekly',
          priority: 0.6,
        }));
      }
      case 'playlists': {
        const rows = await listSitemapPlaylists(SITEMAP_PAGE_SIZE, offset);
        return rows.map((p) => ({
          url: `${SITE_URL}/playlists/${p.id}`,
          lastModified: p.updatedAt,
          changeFrequency: 'weekly',
          priority: 0.5,
        }));
      }
    }
  } catch {
    // ошибка БД на шарде — пустой urlset, не 5xx: краулер не должен спотыкаться на подчинённом файле
    return [];
  }
}
