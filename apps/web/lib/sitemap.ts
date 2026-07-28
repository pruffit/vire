export const SITEMAP_PAGE_SIZE = 10_000;

export type SitemapSection = 'static' | 'artists' | 'releases' | 'tracks' | 'smartlinks' | 'playlists';

export interface ShardId {
  section: SitemapSection;
  page: number;
}

type CountedSection = Exclude<SitemapSection, 'static'>;

// Порядок фиксирован — определяет порядок ссылок в индексе.
const COUNTED_SECTIONS: CountedSection[] = ['artists', 'releases', 'tracks', 'smartlinks', 'playlists'];

export function planShards(counts: Record<CountedSection, number>, pageSize: number = SITEMAP_PAGE_SIZE): ShardId[] {
  const shards: ShardId[] = [{ section: 'static', page: 0 }];
  for (const section of COUNTED_SECTIONS) {
    const pages = Math.ceil(counts[section] / pageSize);
    for (let page = 0; page < pages; page++) {
      shards.push({ section, page });
    }
  }
  return shards;
}

const SHARD_FILE_RE = /^(artists|releases|tracks|smartlinks|playlists)-(0|[1-9]\d*)\.xml$/;

export function parseShardId(raw: string): ShardId | null {
  if (raw === 'static.xml') return { section: 'static', page: 0 };
  const match = SHARD_FILE_RE.exec(raw);
  if (!match) return null;
  return { section: match[1] as CountedSection, page: Number(match[2]) };
}

export function shardFileName(shard: ShardId): string {
  if (shard.section === 'static') return 'static.xml';
  return `${shard.section}-${shard.page}.xml`;
}
