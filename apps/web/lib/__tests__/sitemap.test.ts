import { describe, expect, it } from 'vitest';
import { SITEMAP_PAGE_SIZE, planShards, parseShardId, shardFileName, localizedSitemapUrls, type ShardId } from '../sitemap';

const zeroCounts = { artists: 0, releases: 0, tracks: 0, smartlinks: 0, playlists: 0 };

describe('planShards', () => {
  it('always includes exactly one static shard', () => {
    const shards = planShards(zeroCounts);
    expect(shards).toEqual([{ section: 'static', page: 0 }]);
  });

  it('a section with 0 records gets no shards', () => {
    const shards = planShards({ ...zeroCounts, artists: 0 });
    expect(shards.some((s) => s.section === 'artists')).toBe(false);
  });

  it('exactly pageSize records → one shard', () => {
    const shards = planShards({ ...zeroCounts, artists: 10 }, 10);
    expect(shards.filter((s) => s.section === 'artists')).toEqual([{ section: 'artists', page: 0 }]);
  });

  it('pageSize + 1 records → two shards', () => {
    const shards = planShards({ ...zeroCounts, artists: 11 }, 10);
    expect(shards.filter((s) => s.section === 'artists')).toEqual([
      { section: 'artists', page: 0 },
      { section: 'artists', page: 1 },
    ]);
  });

  it('plans every non-static section independently', () => {
    const shards = planShards(
      { artists: 5, releases: 15, tracks: 25, smartlinks: 0, playlists: 10 },
      10,
    );
    expect(shards).toEqual([
      { section: 'static', page: 0 },
      { section: 'artists', page: 0 },
      { section: 'releases', page: 0 },
      { section: 'releases', page: 1 },
      { section: 'tracks', page: 0 },
      { section: 'tracks', page: 1 },
      { section: 'tracks', page: 2 },
      { section: 'playlists', page: 0 },
    ]);
  });

  it('defaults to SITEMAP_PAGE_SIZE when pageSize is omitted', () => {
    const shards = planShards({ ...zeroCounts, artists: SITEMAP_PAGE_SIZE + 1 });
    expect(shards.filter((s) => s.section === 'artists')).toHaveLength(2);
  });
});

describe('parseShardId', () => {
  it('parses a sectioned shard file name', () => {
    expect(parseShardId('artists-3.xml')).toEqual({ section: 'artists', page: 3 });
  });

  it('parses the static shard', () => {
    expect(parseShardId('static.xml')).toEqual({ section: 'static', page: 0 });
  });

  it('parses page 0', () => {
    expect(parseShardId('releases-0.xml')).toEqual({ section: 'releases', page: 0 });
  });

  it.each([
    '../secret.xml',
    'artists-.xml',
    'artists-01.xml',
    'artists--1.xml',
    'artists-abc.xml',
    'unknown-0.xml',
    'artists-3',
    'artists-3.json',
    '',
  ])('rejects garbage input %s', (raw) => {
    expect(parseShardId(raw)).toBeNull();
  });
});

describe('shardFileName', () => {
  it('renders the static shard', () => {
    expect(shardFileName({ section: 'static', page: 0 })).toBe('static.xml');
  });

  it('renders a sectioned shard', () => {
    expect(shardFileName({ section: 'tracks', page: 7 })).toBe('tracks-7.xml');
  });
});

describe('localizedSitemapUrls', () => {
  it('emits one entry per locale, each carrying the same full alternate set', () => {
    const urls = localizedSitemapUrls('https://vire.ru', '/artists/nova', { priority: 0.7 });
    expect(urls).toHaveLength(2);
    expect(urls.map((u) => u.url)).toEqual([
      'https://vire.ru/artists/nova',
      'https://vire.ru/en/artists/nova',
    ]);
    for (const u of urls) {
      expect(u.priority).toBe(0.7);
      expect(u.alternates).toEqual([
        { hreflang: 'ru', href: 'https://vire.ru/artists/nova' },
        { hreflang: 'en', href: 'https://vire.ru/en/artists/nova' },
        { hreflang: 'x-default', href: 'https://vire.ru/artists/nova' },
      ]);
    }
  });

  it('handles the root path without a trailing slash on the default locale', () => {
    const urls = localizedSitemapUrls('https://vire.ru', '', { priority: 1 });
    expect(urls.map((u) => u.url)).toEqual(['https://vire.ru', 'https://vire.ru/en']);
  });
});

describe('parseShardId(shardFileName(x)) round-trip', () => {
  const cases: ShardId[] = [
    { section: 'static', page: 0 },
    { section: 'artists', page: 0 },
    { section: 'releases', page: 12 },
    { section: 'tracks', page: 999 },
    { section: 'smartlinks', page: 1 },
    { section: 'playlists', page: 0 },
  ];

  it.each(cases)('round-trips %o', (shard) => {
    expect(parseShardId(shardFileName(shard))).toEqual(shard);
  });
});
