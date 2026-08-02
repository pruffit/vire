import { db, DrizzleSearchRepository, DrizzleResolutionCache } from '@vire/db';
import { SearchService, ExternalResolveService, normalizeQueryKey, type IPageMetaFetcher, type IMetadataIndex, type MetadataHint, type PageMeta } from '@vire/core';
import { fetchOembed } from './oembed';
import { fetchPageMeta } from './page-meta';
import { fetchProviderMeta } from './providers';
import { createYoutubeResolver } from './youtube';
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
    const provider = await fetchProviderMeta(url);
    const meta = provider ? await enrichArtist(provider) : OEMBED_HOSTS.test(host) ? await fetchOembed(url) : await fetchPageMeta(url);
    return meta && { ...meta, coverUrl: sanitizeCoverUrl(meta.coverUrl) };
  },
};

// Spotify oEmbed не отдаёт исполнителя — достаём его из iTunes+Deezer метаиндекса, но только
// при точном совпадении нормализованного названия (иначе можно подставить чужого артиста).
async function enrichArtist(meta: PageMeta): Promise<PageMeta> {
  if (meta.artistName) return meta;
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

export function externalResolveService(): ExternalResolveService {
  return new ExternalResolveService({
    search: new SearchService(new DrizzleSearchRepository(db)),
    metadataIndex,
    playableResolver: createYoutubeResolver(process.env.YOUTUBE_API_KEY),
    pageMetaFetcher,
    cache: new DrizzleResolutionCache(db),
    clock: Date.now,
    siteHost: new URL(SITE_URL).hostname,
  });
}
