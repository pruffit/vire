import { describe, it, expect, vi, beforeEach } from 'vitest';
import { artistCatalogResponseSchema } from '@vire/api-contracts';

const { list } = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistCatalogRepository: class {
    list = list;
  },
}));

import { GET } from './route';

function req(query = ''): Request {
  return new Request(`http://localhost/api/v1/artists${query}`);
}

function makeCard(overrides?: Record<string, unknown>) {
  return {
    id: 'artist-1',
    slug: 'artist',
    name: 'Artist',
    bio: null,
    avatarUrl: null,
    firstReleaseCoverUrl: null,
    verified: false,
    releaseCount: 0,
    genres: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([]);
});

describe('GET /api/v1/artists', () => {
  it('200 with defaults, response matches the contract', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = artistCatalogResponseSchema.parse(body);
    expect(parsed.items).toEqual([]);
    expect(parsed.hasMore).toBe(false);
    // без явного limit роут отдаёт страницу в 60, а не дефолт сервиса (200 — для витрины)
    expect(list).toHaveBeenCalledWith({ query: null, limit: 61, offset: 0 });
  });

  it('passes query/limit/offset through to the repository', async () => {
    const res = await GET(req('?query=wave&limit=10&offset=20'));
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith({ query: 'wave', limit: 11, offset: 20 });
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

  it('400 on offset=10001', async () => {
    const res = await GET(req('?offset=10001'));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('400 on a query longer than 100 characters', async () => {
    const res = await GET(req(`?query=${'a'.repeat(101)}`));
    expect(res.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });

  it('200 on offset=10000 (upper bound inclusive)', async () => {
    const res = await GET(req('?offset=10000'));
    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith(expect.objectContaining({ offset: 10000 }));
  });

  it('hasMore=true when the repository returns limit + 1 records', async () => {
    list.mockResolvedValue([makeCard({ id: '1' }), makeCard({ id: '2' })]);
    const res = await GET(req('?limit=1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = artistCatalogResponseSchema.parse(body);
    expect(parsed.hasMore).toBe(true);
    expect(parsed.items).toHaveLength(1);
  });
});
