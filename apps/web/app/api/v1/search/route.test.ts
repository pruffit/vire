import { describe, it, expect, vi, beforeEach } from 'vitest';

const { searchAll, rateLimit } = vi.hoisted(() => ({
  searchAll: vi.fn(),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
}));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleSearchRepository: class {
    searchAll = searchAll;
  },
}));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'search:test'),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { GET } from './route';

const RESULTS = {
  artists: [{ id: 'a1', slug: 'a1', name: 'Artist', avatarUrl: null, firstReleaseCoverUrl: null, verified: false }],
  releases: [],
  tracks: [],
};

function req(q: string): Request {
  return new Request(`http://localhost/api/v1/search?q=${encodeURIComponent(q)}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 });
  searchAll.mockResolvedValue(RESULTS);
});

describe('GET /api/v1/search', () => {
  it('429 when rate-limited', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 60 });
    const res = await GET(req('hello'));
    expect(res.status).toBe(429);
    expect(searchAll).not.toHaveBeenCalled();
  });

  it('returns an empty result without querying the repository for q shorter than 2 chars', async () => {
    const res = await GET(req('a'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ artists: [], releases: [], tracks: [] });
    expect(searchAll).not.toHaveBeenCalled();
  });

  it('happy path: delegates to the repository with limit=4 and returns its shape', async () => {
    const res = await GET(req('hello'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(RESULTS);
    expect(searchAll).toHaveBeenCalledWith('hello', 4);
  });
});
