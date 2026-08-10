import { LOCALES, DEFAULT_LOCALE, localizedPath } from '@vire/i18n/config';
import type { SitemapUrl } from './sitemap-xml';

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

export interface SitemapUrlMeta {
  lastModified?: Date;
  changeFrequency?: string;
  priority?: number;
}

/** Одна страница → по одной <url>-записи на локаль (as-needed: ru без префикса, en с /en),
 *  каждая с полным набором xhtml:link alternate (обе локали + x-default) — рекомендация
 *  Google для мультиязычных сайтмапов, не одна запись с альтернативами-ссылками мимо себя. */
export function localizedSitemapUrls(siteUrl: string, path: string, meta: SitemapUrlMeta = {}): SitemapUrl[] {
  const alternates = [
    ...LOCALES.map((locale) => ({ hreflang: locale, href: `${siteUrl}${localizedPath(locale, path)}` })),
    { hreflang: 'x-default', href: `${siteUrl}${localizedPath(DEFAULT_LOCALE, path)}` },
  ];
  return LOCALES.map((locale) => ({
    url: `${siteUrl}${localizedPath(locale, path)}`,
    alternates,
    ...meta,
  }));
}
