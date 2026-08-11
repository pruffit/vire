import { describe, it, expect, vi } from 'vitest';
import { ReleaseCatalogService } from './release-catalog';
import type { IReleaseCatalogRepository } from '../repositories/release-catalog';
import type { ReleaseCard } from '../types/release-card';

function makeCard(overrides?: Partial<ReleaseCard>): ReleaseCard {
  return {
    id: 'release-1',
    title: 'Test Release',
    type: 'ALBUM',
    coverUrl: null,
    releaseDate: null,
    artistName: 'Test Artist',
    artistSlug: 'test-artist',
    artistAvatarUrl: null,
    hasExplicit: false,
    accentColor: null,
    ...overrides,
  };
}

function makeRepo(list: ReleaseCard[]): IReleaseCatalogRepository {
  return { list: vi.fn().mockResolvedValue(list) };
}

describe('ReleaseCatalogService.list — дефолты', () => {
  it('defaults sort to fresh, limit to 60, offset to 0, sinceDays to null on empty input', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({});

    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.list).toHaveBeenCalledWith({ sort: 'fresh', sinceDays: null, limit: 61, offset: 0 });
  });
});

describe('ReleaseCatalogService.list — клампы', () => {
  it('clamps limit: 0 up to the minimum of 1', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ limit: 0 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }));
  });

  it('clamps limit: 999 down to the maximum of 60', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ limit: 999 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 61 }));
  });

  it('clamps offset: -5 up to 0', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ offset: -5 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  it('clamps sinceDays: 0 up to the minimum of 1', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ sinceDays: 0 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ sinceDays: 1 }));
  });

  it('floors fractional limit/offset/sinceDays', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ limit: 10.9, offset: 3.7, sinceDays: 5.9 });

    expect(repo.list).toHaveBeenCalledWith({ sort: 'fresh', sinceDays: 5, limit: 11, offset: 3 });
  });

  it('clamps offset: above the maximum of 10000 down to 10000', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ offset: 1e21 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ offset: 10000 }));
  });

  it('clamps sinceDays: above the maximum of 365 down to 365', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ sinceDays: 1e21 });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ sinceDays: 365 }));
  });

  it('leaves sinceDays: null untouched', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ sinceDays: null });

    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ sinceDays: null }));
  });
});

describe('ReleaseCatalogService.list — порт вызывается с limit + 1', () => {
  it('requests limit + 1 records from the port, exactly once', async () => {
    const repo = makeRepo([]);
    const service = new ReleaseCatalogService(repo);

    await service.list({ limit: 24 });

    expect(repo.list).toHaveBeenCalledTimes(1);
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 25 }));
  });
});

describe('ReleaseCatalogService.list — hasMore и срезание хвоста', () => {
  it('hasMore=true and trims the trailing record when the port returns limit + 1', async () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' }), makeCard({ id: '3' })];
    const repo = makeRepo(cards);
    const service = new ReleaseCatalogService(repo);

    const result = await service.list({ limit: 2 });

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((i) => i.id)).toEqual(['1', '2']);
  });

  it('hasMore=false when the port returns exactly limit records', async () => {
    const cards = [makeCard({ id: '1' }), makeCard({ id: '2' })];
    const repo = makeRepo(cards);
    const service = new ReleaseCatalogService(repo);

    const result = await service.list({ limit: 2 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(2);
  });

  it('hasMore=false when the port returns fewer than limit records', async () => {
    const cards = [makeCard({ id: '1' })];
    const repo = makeRepo(cards);
    const service = new ReleaseCatalogService(repo);

    const result = await service.list({ limit: 2 });

    expect(result.hasMore).toBe(false);
    expect(result.items).toHaveLength(1);
  });
});
