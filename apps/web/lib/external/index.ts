import { db, DrizzleSearchRepository, DrizzleResolutionCache } from '@vire/db';
import { SearchService, ExternalResolveService, type IPageMetaFetcher, type IMetadataIndex, type MetadataHint } from '@vire/core';
import { fetchOembed } from './oembed';
import { fetchPageMeta } from './page-meta';
import { createYoutubeResolver } from './youtube';
import { createItunesMetadataIndex } from './itunes';
import { createDeezerMetadataIndex } from './deezer';
import { SITE_URL } from '@/lib/site';

const OEMBED_HOSTS = /(^|\.)(youtube\.com|youtu\.be|soundcloud\.com)$/i;

// YouTube/SoundCloud — фиксированный oEmbed-эндпоинт (бесплатно, без SSRF-риска); остальное —
// общий SSRF-guarded фетчер страницы (oEmbed-дискавери → og/twitter → JSON-LD).
const pageMetaFetcher: IPageMetaFetcher = {
  async fetch(url) {
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      return null;
    }
    if (OEMBED_HOSTS.test(host)) return fetchOembed(url);
    return fetchPageMeta(url);
  },
};

function createMetadataIndex(): IMetadataIndex {
  const itunes = createItunesMetadataIndex();
  const deezer = createDeezerMetadataIndex();
  return {
    async suggest(query, limit) {
      const [a, b] = await Promise.all([itunes.suggest(query, limit), deezer.suggest(query, limit)]);
      return dedupeHints([...a, ...b]).slice(0, limit);
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

export function externalResolveService(): ExternalResolveService {
  return new ExternalResolveService({
    search: new SearchService(new DrizzleSearchRepository(db)),
    metadataIndex: createMetadataIndex(),
    playableResolver: createYoutubeResolver(process.env.YOUTUBE_API_KEY),
    pageMetaFetcher,
    cache: new DrizzleResolutionCache(db),
    clock: Date.now,
    siteHost: new URL(SITE_URL).hostname,
  });
}
