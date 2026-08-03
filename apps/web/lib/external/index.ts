import { db, DrizzleSearchRepository, DrizzleResolutionCache, DrizzleResolvedIndex } from '@vire/db';
import { SearchService, ExternalResolveService, normalizeQueryKey, type IPageMetaFetcher, type IPlayableResolver, type IMetadataIndex, type MetadataHint, type PageMeta } from '@vire/core';
import { fetchOembed } from './oembed';
import { fetchPageMeta } from './page-meta';
import { fetchProviderMeta } from './providers';
import { fetchOdesliMeta } from './odesli';
import { createYoutubeResolver } from './youtube';
import { searchAudius, resolveAudiusUrl } from './audius';
import { createItunesMetadataIndex } from './itunes';
import { createDeezerMetadataIndex } from './deezer';
import { sanitizeCoverUrl } from './cover-hosts';
import { SITE_URL } from '@/lib/site';

const OEMBED_HOSTS = /(^|\.)(youtube\.com|youtu\.be|soundcloud\.com)$/i;

const metadataIndex = createMetadataIndex();

// Провайдерский API (Spotify/Apple Music/Deezer) → YouTube/SoundCloud oEmbed → общий
// SSRF-guarded фетчер страницы (oEmbed-дискавери → og/twitter → JSON-LD).
const pageMetaFetcher: IPageMetaFetcher = {
  async fetch(url) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      return null;
    }
    const meta = await resolveMeta(url, host);
    return meta && { ...meta, coverUrl: sanitizeCoverUrl(meta.coverUrl) };
  },
};

async function resolveMeta(url: string, host: string): Promise<PageMeta | null> {
  const provider = await fetchProviderMeta(url);
  if (provider) return withArtist(provider, url);
  if (OEMBED_HOSTS.test(host)) return fetchOembed(url);
  // Страница может не отдаться вовсе (Яндекс/VK отвечают ботам 403) — тогда спрашиваем Odesli.
  return (await fetchPageMeta(url)) ?? await fetchOdesliMeta(url);
}

/**
 * Spotify oEmbed отдаёт название без исполнителя, а без него поиск ловит что угодно — вплоть
 * до целого альбома с похожим названием. Исполнителя знает Odesli (по той же ссылке);
 * не ответил — пробуем метаиндекс по точному совпадению названия.
 */
async function withArtist(meta: PageMeta, url: string): Promise<PageMeta> {
  if (meta.artistName) return meta;
  const odesli = await fetchOdesliMeta(url);
  if (odesli?.artistName) return { ...meta, artistName: odesli.artistName, title: odesli.title || meta.title };
  return (await enrichArtist(meta)) ?? meta;
}

// Spotify oEmbed не отдаёт исполнителя — достаём его из iTunes+Deezer метаиндекса, но только
// при точном совпадении нормализованного названия (иначе можно подставить чужого артиста).
async function enrichArtist(meta: PageMeta | null): Promise<PageMeta | null> {
  if (!meta || meta.artistName) return meta;
  const targetKey = normalizeQueryKey('', meta.title);
  const hints = await metadataIndex.suggest(meta.title, 5);
  const match = hints.find((h) => normalizeQueryKey('', h.title) === targetKey);
  return match ? { ...meta, artistName: match.artistName } : meta;
}

function createMetadataIndex(): IMetadataIndex {
  const itunes = createItunesMetadataIndex();
  const deezer = createDeezerMetadataIndex();
  return {
    async suggest(query, limit) {
      const [a, b] = await Promise.all([itunes.suggest(query, limit), deezer.suggest(query, limit)]);
      return dedupeHints([...a, ...b])
        .slice(0, limit)
        .map((h) => ({ ...h, coverUrl: sanitizeCoverUrl(h.coverUrl) }));
    },
  };
}

function dedupeHints(hints: MetadataHint[]): MetadataHint[] {
  const seen = new Set<string>();
  const out: MetadataHint[] = [];
  for (const h of hints) {
    const key = `${h.artistName.toLowerCase()}::${h.title.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/** Ссылка audius.co резолвится их же API, всё остальное — прежним резолвером YouTube. */
function withAudius(resolver: IPlayableResolver): IPlayableResolver {
  return {
    async resolveUrl(url) {
      const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } })();
      if (host === 'audius.co' || host === 'www.audius.co') return resolveAudiusUrl(url);
      return resolver.resolveUrl(url);
    },
    searchOne: (query, expect) => resolver.searchOne(query, expect),
  };
}

export function externalResolveService(): ExternalResolveService {
  return new ExternalResolveService({
    search: new SearchService(new DrizzleSearchRepository(db)),
    metadataIndex,
    playableResolver: withAudius(createYoutubeResolver(process.env.YOUTUBE_API_KEY)),
    playableSearch: { search: (query, limit) => searchAudius(query, limit).catch(() => []) },
    pageMetaFetcher,
    cache: new DrizzleResolutionCache(db),
    resolvedIndex: new DrizzleResolvedIndex(db),
    clock: Date.now,
    siteHost: new URL(SITE_URL).hostname,
  });
}
