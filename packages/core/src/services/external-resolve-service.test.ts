import { describe, it, expect, beforeEach } from 'vitest';
import { ExternalResolveService } from './external-resolve-service';
import { SearchService } from './search';
import type { ISearchRepository } from '../repositories/search';
import type { SearchResults, SearchTrack } from '../types/search';
import type { IMetadataIndex, IPlayableResolver, IPlayableSearch, IPageMetaFetcher, IResolutionCache, IResolvedIndex, ResolutionKey, CachedResolution } from '../ports/external';
import type { ExternalTrackRef, MetadataHint } from '../types/external';

const SITE_HOST = 'viremusic.ru';

class FakeSearchRepository implements ISearchRepository {
  tracks: SearchTrack[] = [];
  async searchAll(): Promise<SearchResults> {
    return { artists: [], releases: [], tracks: this.tracks };
  }
}

class FakeMetadataIndex implements IMetadataIndex {
  hints: MetadataHint[] = [];
  calls = 0;
  async suggest(): Promise<MetadataHint[]> {
    this.calls++;
    return this.hints;
  }
}

class FakePlayableResolver implements IPlayableResolver {
  resolveUrlResult: ExternalTrackRef | null = null;
  searchOneResult: ExternalTrackRef | null = null;
  resolveUrlCalls = 0;
  searchOneCalls = 0;
  async resolveUrl(): Promise<ExternalTrackRef | null> {
    this.resolveUrlCalls++;
    return this.resolveUrlResult;
  }
  async searchOne(): Promise<ExternalTrackRef | null> {
    this.searchOneCalls++;
    return this.searchOneResult;
  }
}

class FakePageMetaFetcher implements IPageMetaFetcher {
  result: { title: string; artistName: string | null; coverUrl: string | null; durationSec: number | null } | null = null;
  calls = 0;
  async fetch() {
    this.calls++;
    return this.result;
  }
}

class FakePlayableSearch implements IPlayableSearch {
  refs: ExternalTrackRef[] = [];
  calls = 0;
  async search(_query: string, limit: number): Promise<ExternalTrackRef[]> {
    this.calls++;
    return this.refs.slice(0, limit);
  }
}

class FakeResolvedIndex implements IResolvedIndex {
  refs: ExternalTrackRef[] = [];
  async search(query: string, limit: number): Promise<ExternalTrackRef[]> {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return this.refs
      .filter((ref) => tokens.every((t) => `${ref.artistName} ${ref.title}`.toLowerCase().includes(t)))
      .slice(0, limit);
  }
}

class FakeResolutionCache implements IResolutionCache {
  store = new Map<string, CachedResolution>();
  private keyOf(key: ResolutionKey) {
    return `${key.kind}:${key.value}`;
  }
  async get(key: ResolutionKey): Promise<CachedResolution | null> {
    return this.store.get(this.keyOf(key)) ?? null;
  }
  async put(key: ResolutionKey, ref: ExternalTrackRef | null): Promise<void> {
    this.store.set(this.keyOf(key), ref ? { found: true, ref } : { found: false, resolvedAt: new Date(NOW) });
  }
}

const NOW = new Date('2026-08-02T12:00:00Z').getTime();

function buildService(overrides?: { searchRepo?: FakeSearchRepository; metadataIndex?: FakeMetadataIndex; playableResolver?: FakePlayableResolver; pageMetaFetcher?: FakePageMetaFetcher; cache?: FakeResolutionCache; resolvedIndex?: FakeResolvedIndex; playableSearch?: FakePlayableSearch; clock?: () => number }) {
  const searchRepo = overrides?.searchRepo ?? new FakeSearchRepository();
  const metadataIndex = overrides?.metadataIndex ?? new FakeMetadataIndex();
  const playableResolver = overrides?.playableResolver ?? new FakePlayableResolver();
  const pageMetaFetcher = overrides?.pageMetaFetcher ?? new FakePageMetaFetcher();
  const cache = overrides?.cache ?? new FakeResolutionCache();
  const resolvedIndex = overrides?.resolvedIndex ?? new FakeResolvedIndex();
  const playableSearch = overrides?.playableSearch ?? new FakePlayableSearch();
  const clock = overrides?.clock ?? (() => NOW);

  const service = new ExternalResolveService({
    search: new SearchService(searchRepo),
    metadataIndex,
    playableResolver,
    pageMetaFetcher,
    cache,
    resolvedIndex,
    playableSearch,
    clock,
    siteHost: SITE_HOST,
  });

  return { service, searchRepo, metadataIndex, playableResolver, pageMetaFetcher, cache, resolvedIndex, playableSearch };
}

const track = (overrides: Partial<SearchTrack>): SearchTrack => ({
  id: 't1', title: 'Группа крови', releaseId: 'r1', artistSlug: 'kino', artistName: 'Кино', coverUrl: null, version: null, feat: [],
  ...overrides,
});

const ytRef: ExternalTrackRef = {
  source: 'YOUTUBE', externalId: 'dQw4w9WgXcQ', externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Some Song', artistName: 'Some Artist', coverUrl: 'https://img', durationSec: 200,
};

describe('ExternalResolveService.resolve — own URL', () => {
  it('a direct link to our own track resolves to VIRE without touching any port', async () => {
    const { service, pageMetaFetcher, playableResolver } = buildService();
    const trackId = '11111111-1111-1111-1111-111111111111';
    const releaseId = '22222222-2222-2222-2222-222222222222';

    const outcome = await service.resolve(`https://viremusic.ru/artists/kino/releases/${releaseId}/tracks/${trackId}`);

    expect(outcome).toEqual({ outcome: 'vire', trackId });
    expect(pageMetaFetcher.calls).toBe(0);
    expect(playableResolver.resolveUrlCalls).toBe(0);
  });
});

describe('ExternalResolveService.resolve — known playable URL', () => {
  it('a YouTube link resolves via the playable resolver (Data API) directly, no catalog check', async () => {
    const { service, playableResolver, searchRepo } = buildService();
    searchRepo.tracks = [track({ id: 'would-not-be-used' })];
    playableResolver.resolveUrlResult = ytRef;

    const outcome = await service.resolve('https://youtu.be/dQw4w9WgXcQ');

    expect(outcome).toEqual({ outcome: 'external', ref: ytRef });
  });

  it('falls back to page-meta (oEmbed) when the Data API resolver has no key/errors', async () => {
    const { service, playableResolver, pageMetaFetcher } = buildService();
    playableResolver.resolveUrlResult = null;
    pageMetaFetcher.result = { title: 'Some Song', artistName: 'Some Artist', coverUrl: 'https://img', durationSec: null };

    const outcome = await service.resolve('https://youtu.be/dQw4w9WgXcQ');

    expect(outcome).toEqual({
      outcome: 'external',
      ref: { source: 'YOUTUBE', externalId: 'dQw4w9WgXcQ', externalUrl: 'https://youtu.be/dQw4w9WgXcQ', title: 'Some Song', artistName: 'Some Artist', coverUrl: 'https://img', durationSec: null },
    });
  });

  it('a known-playable URL never reaches a dead end when nothing resolves — returns empty candidates, not an error', async () => {
    const { service } = buildService();
    const outcome = await service.resolve('https://youtu.be/deadlink000');
    expect(outcome).toEqual({ outcome: 'candidates', candidates: [] });
  });

  it('a repeated same link hits the cache and does not call the resolver again', async () => {
    const { service, playableResolver } = buildService();
    playableResolver.resolveUrlResult = ytRef;

    await service.resolve('https://youtu.be/dQw4w9WgXcQ');
    playableResolver.resolveUrlResult = null;
    const second = await service.resolve('https://youtu.be/dQw4w9WgXcQ');

    expect(second).toEqual({ outcome: 'external', ref: ytRef });
    expect(playableResolver.resolveUrlCalls).toBe(1);
  });
});

describe('ExternalResolveService.resolve — unknown/non-playable URL degrades to page-meta then catalog/search', () => {
  it('page-meta title matches a catalog track — VIRE wins over YouTube search', async () => {
    const { service, searchRepo, pageMetaFetcher, playableResolver } = buildService();
    searchRepo.tracks = [track({ id: 't-match' })];
    pageMetaFetcher.result = { title: 'Группа крови', artistName: 'Кино', coverUrl: null, durationSec: null };

    const outcome = await service.resolve('https://open.spotify.com/track/abc123');

    expect(outcome).toEqual({ outcome: 'vire', trackId: 't-match' });
    expect(playableResolver.searchOneCalls).toBe(0);
  });

  it('no catalog match — falls to YouTube search and caches the result', async () => {
    const { service, pageMetaFetcher, playableResolver, cache } = buildService();
    pageMetaFetcher.result = { title: 'Some Song', artistName: 'Some Artist', coverUrl: null, durationSec: null };
    playableResolver.searchOneResult = ytRef;

    const outcome = await service.resolve('https://open.spotify.com/track/abc123');

    expect(outcome).toEqual({ outcome: 'external', ref: ytRef });
    const queryCached = await cache.get({ kind: 'QUERY', value: 'v2:some artist::some song' });
    expect(queryCached).toEqual({ found: true, ref: ytRef });
  });

  it('page-meta fetch fails entirely — degrades to candidates, never an error', async () => {
    const { service, pageMetaFetcher } = buildService();
    pageMetaFetcher.result = null;

    const outcome = await service.resolve('https://open.spotify.com/track/abc123');

    expect(outcome).toEqual({ outcome: 'candidates', candidates: [] });
  });

  it('unknown host with no page meta and nothing in the catalog still returns candidates from the metaindex', async () => {
    const { service, pageMetaFetcher, metadataIndex } = buildService();
    pageMetaFetcher.result = { title: 'Some Song', artistName: 'Some Artist', coverUrl: null, durationSec: null };
    metadataIndex.hints = [{ title: 'Some Song', artistName: 'Some Artist', coverUrl: null, durationSec: 180 }];

    const outcome = await service.resolve('https://example.com/whatever');

    expect(outcome.outcome).toBe('candidates');
    if (outcome.outcome === 'candidates') {
      expect(outcome.candidates).toEqual([{ kind: 'HINT', hint: metadataIndex.hints[0] }]);
    }
  });
});

describe('ExternalResolveService.resolve — plain text query', () => {
  it('an exact catalog match resolves directly, free', async () => {
    const { service, searchRepo, playableResolver, metadataIndex } = buildService();
    searchRepo.tracks = [track({ id: 't-match' })];

    const outcome = await service.resolve('Кино Группа крови');

    expect(outcome).toEqual({ outcome: 'vire', trackId: 't-match' });
    expect(playableResolver.searchOneCalls).toBe(0);
    expect(metadataIndex.calls).toBe(0);
  });

  it('no catalog match — resolves via YouTube search (spends quota) and is cached', async () => {
    const { service, playableResolver, cache } = buildService();
    playableResolver.searchOneResult = ytRef;

    const outcome = await service.resolve('some random song');

    expect(outcome).toEqual({ outcome: 'external', ref: ytRef });
    expect(playableResolver.searchOneCalls).toBe(1);
    const cached = await cache.get({ kind: 'QUERY', value: 'v2:::some random song' });
    expect(cached).toEqual({ found: true, ref: ytRef });
  });

  it('в очередь идёт «артист — трек» из метаданных, а не заголовок ролика с каналом', async () => {
    const { service, playableResolver, pageMetaFetcher } = buildService();
    pageMetaFetcher.result = { title: 'Numbed In Moscow', artistName: 'Portishead', coverUrl: null, durationSec: 234 };
    playableResolver.searchOneResult = {
      source: 'YOUTUBE', externalId: 'vid', externalUrl: 'https://youtu.be/vid',
      title: 'Portishead - Numbed In Moscow (1994 - Singles - Nobody Loves Me)', artistName: 'Harry',
      coverUrl: 'https://i.ytimg.com/vi/vid/hq.jpg', durationSec: null,
    };

    const outcome = await service.resolve('https://music.yandex.ru/album/1/track/2');

    expect(outcome).toEqual({
      outcome: 'external',
      ref: expect.objectContaining({ externalId: 'vid', title: 'Numbed In Moscow', artistName: 'Portishead', durationSec: 234 }),
    });
  });

  it('a fresh cache hit avoids a second YouTube call entirely (quota discipline)', async () => {
    const { service, playableResolver } = buildService();
    playableResolver.searchOneResult = ytRef;
    await service.resolve('some random song');

    playableResolver.searchOneResult = null;
    const second = await service.resolve('some random song');

    expect(second).toEqual({ outcome: 'external', ref: ytRef });
    expect(playableResolver.searchOneCalls).toBe(1);
  });

  it('negative cache (not_found) within 30 days skips YouTube on a repeat search', async () => {
    const { service, playableResolver } = buildService();
    playableResolver.searchOneResult = null;

    await service.resolve('nothing anywhere');
    expect(playableResolver.searchOneCalls).toBe(1);

    const second = await service.resolve('nothing anywhere');
    expect(second.outcome).toBe('candidates');
    expect(playableResolver.searchOneCalls).toBe(1);
  });

  it('a stale (>30 day) negative cache entry is rechecked against YouTube', async () => {
    let now = NOW;
    const { service, playableResolver } = buildService({ clock: () => now });
    playableResolver.searchOneResult = null;

    await service.resolve('nothing anywhere');
    expect(playableResolver.searchOneCalls).toBe(1);

    now += 31 * 24 * 60 * 60 * 1000;
    playableResolver.searchOneResult = ytRef;
    const second = await service.resolve('nothing anywhere');

    expect(second).toEqual({ outcome: 'external', ref: ytRef });
    expect(playableResolver.searchOneCalls).toBe(2);
  });

  it('everything fails — returns candidates (possibly empty), never a dead-end error', async () => {
    const { service } = buildService();
    const outcome = await service.resolve('complete gibberish nobody has');
    expect(outcome.outcome).toBe('candidates');
  });

  it('empty text input does not crash and returns empty candidates', async () => {
    const { service } = buildService();
    const outcome = await service.resolve('   ');
    expect(outcome).toEqual({ outcome: 'candidates', candidates: [] });
  });
});

describe('ExternalResolveService.suggest', () => {
  it('combines catalog and metaindex hints, catalog first, deduped', async () => {
    const { service, searchRepo, metadataIndex } = buildService();
    searchRepo.tracks = [track({ id: 't1' })];
    metadataIndex.hints = [
      { title: 'Группа крови', artistName: 'Кино', coverUrl: null, durationSec: null },
      { title: 'Другая песня', artistName: 'Кино', coverUrl: null, durationSec: null },
    ];

    const candidates = await service.suggest('Кино', 10);

    expect(candidates).toEqual([
      { kind: 'VIRE', trackId: 't1', title: 'Группа крови', artistName: 'Кино', coverUrl: null },
      { kind: 'HINT', hint: metadataIndex.hints[1] },
    ]);
  });

  it('уже отрезолвленное кем-то идёт готовым к добавлению — после каталога, до хинтов', async () => {
    const { service, searchRepo, metadataIndex, resolvedIndex } = buildService();
    searchRepo.tracks = [];
    resolvedIndex.refs = [
      { source: 'YOUTUBE', externalId: 'yt1', externalUrl: 'https://youtu.be/yt1', title: 'Группа крови', artistName: 'Кино', coverUrl: null, durationSec: 280 },
    ];
    metadataIndex.hints = [{ title: 'Группа крови', artistName: 'Кино', coverUrl: null, durationSec: null }];

    const candidates = await service.suggest('Кино группа', 10);

    // Хинт того же трека отсеивается дедупом — играбельный вариант важнее.
    expect(candidates).toEqual([{ kind: 'EXTERNAL', ref: resolvedIndex.refs[0] }]);
  });

  it('a too-short query returns no candidates without hitting any port', async () => {
    const { service, searchRepo, metadataIndex } = buildService();
    const spy = { calls: 0 };
    searchRepo.searchAll = async () => {
      spy.calls++;
      return { artists: [], releases: [], tracks: [] };
    };

    const candidates = await service.suggest('a', 10);

    expect(candidates).toEqual([]);
    expect(spy.calls).toBe(0);
    expect(metadataIndex.calls).toBe(0);
  });
});
