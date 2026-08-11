import { describe, it, expect, vi } from 'vitest';
import { ArtistCatalogService } from './artist-catalog';
import type { IArtistCatalogRepository } from '../repositories/artist-catalog';
import type { ArtistCard } from '../types/artist-card';

function makeCard(overrides?: Partial<ArtistCard>): ArtistCard {
  return {
    id: 'artist-1',
    slug: 'test-artist',
    name: 'Test Artist',
    bio: null,
    avatarUrl: null,
    firstReleaseCoverUrl: null,
    verified: false,
    releaseCount: 0,
    genres: [],
    ...overrides,
  };
}

function makeRepo(list: ArtistCard[]): IArtistCatalogRepository {
  return { list: vi.fn().mockResolvedValue(list) };
}

describe('ArtistCatalogService.list — дефолты', () => {
  it('defaults query to null, limit to 200, offset to 0 on empty input', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({});

    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.list).toHaveBeenCalledWith({ query: null, limit: 201, offset: 0 });
  });
});

describe('ArtistCatalogService.list — клампы', () => {
  it('clamps limit: 0 up to the minimum of 1', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ limit: 0 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }));
  });

  it('clamps limit: 999 down to the maximum of 200', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ limit: 999 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 201 }));
  });

  it('clamps offset: -5 up to 0', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ offset: -5 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it('clamps offset: above the maximum of 10000 down to 10000', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ offset: 1e21 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 10000 }));
  });

  it('floors fractional limit/offset', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ limit: 10.9, offset: 3.7 });

    expect(repo.list).toHaveBeenCalledWith({ query: null, limit: 11, offset: 3 });
  });
});

describe('ArtistCatalogService.list — тримминг запроса', () => {
  it('trims whitespace around query', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ query: '  test  ' });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ query: 'test' }));
  });

  it('normalizes a whitespace-only query to null', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ query: '   ' });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ query: null }));
  });

  it('normalizes an empty string query to null', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ query: '' });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ query: null }));
  });

  it('leaves query: null untouched', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ query: null });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ query: null }));
  });
});

describe('ArtistCatalogService.list — порт вызывается с limit + 1', () => {
  it('requests limit + 1 records from the port, exactly once', async () => {
    const repo = makeRepo([]);
    const service = new ArtistCatalogService(repo);

    await service.list({ limit: 24 });

    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }));
  });
});

describe('ArtistCatalogService.list — hasMore и срезание хвоста', () => {
  it('hasMore=true and trims the trailing record when the port returns limit + 1', async () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' }), makeCard({ id: '3' })];
    const repo = makeRepo(cards);
    const service = new ArtistCatalogService(repo);

    const result = await service.list({ limit: 2 });

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.id)).toEqual(['1', '2']);
  });

  it('hasMore=false when the port returns exactly limit records', async () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' })];
    const repo = makeRepo(cards);
    const service = new ArtistCatalogService(repo);

    const result = await service.list({ limit: 2 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(2);
  });

  it('hasMore=false when the port returns fewer than limit records', async () => {
    const cards = [makeCard({ id: '1' })];
    const repo = makeRepo(cards);
    const service = new ArtistCatalogService(repo);

    const result = await service.list({ limit: 2 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(1);
  });
});
