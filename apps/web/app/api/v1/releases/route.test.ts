import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releaseCatalogResponseSchema } from '@vire/api-contracts';

const { list } = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleReleaseCatalogRepository: class {
    list = list;
  },
}));

import { GET } from './route';

function req(query = ''): Request {
  return new Request(`http://localhost/api/v1/releases${query}`);
}

function makeCard(overrides?: Record<string, unknown>) {
  return {
    id: 'release-1',
    title: 'Title',
    type: 'ALBUM',
    coverUrl: null,
    releaseDate: null,
    artistName: 'Artist',
    artistSlug: 'artist',
    artistAvatarUrl: null,
    hasExplicit: false,
    accentColor: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([]);
});

describe('GET /api/v1/releases', () => {
  it('200 with defaults, response matches the contract', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = releaseCatalogResponseSchema.parse(body);
    expect(parsed.items).toEqual([]);
    expect(parsed.hasMore).toBe(false);
    expect(list).toHaveBeenCalledWith({ sort: 'fresh', sinceDays: null, limit: 61, offset: 0 });
  });

  it('passes sort/sinceDays/limit/offset through to the repository', async () => {
    const res = await GET(req('?sort=popular&sinceDays=7&limit=10&offset=20'));
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ sort: 'popular', sinceDays: 7, limit: 11, offset: 20 });
  });

  it('400 on invalid sort', async () => {
    const res = await GET(req('?sort=bogus'));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('400 on limit=0', async () => {
    const res = await GET(req('?limit=0'));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('400 on limit=61', async () => {
    const res = await GET(req('?limit=61'));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('400 on sinceDays=1e21', async () => {
    const res = await GET(req('?sinceDays=1e21'));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('400 on sinceDays=400', async () => {
    const res = await GET(req('?sinceDays=400'));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('400 on offset=1e21', async () => {
    const res = await GET(req('?offset=1e21'));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('400 on offset=10001', async () => {
    const res = await GET(req('?offset=10001'));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('200 on offset=10000 (upper bound inclusive)', async () => {
    const res = await GET(req('?offset=10000'));
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ offset: 10000 }));
  });

  it('200 on sinceDays=365 (upper bound inclusive)', async () => {
    const res = await GET(req('?sinceDays=365'));
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ sinceDays: 365 }));
  });

  it('hasMore=true when the repository returns limit + 1 records', async () => {
    list.mockResolvedValue([makeCard({ id: '1' }), makeCard({ id: '2' })]);
    const res = await GET(req('?limit=1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = releaseCatalogResponseSchema.parse(body);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.items).toHaveLength(1);
  });

  it('maps releaseDate to an ISO string in the response', async () => {
    list.mockResolvedValue([makeCard({ releaseDate: new Date('2024-01-01T00:00:00.000Z') })]);
    const res = await GET(req());
    const body = await res.json();
    const parsed = releaseCatalogResponseSchema.parse(body);
    expect(parsed.items[0].releaseDate).toBe('2024-01-01T00:00:00.000Z');
  });
});
