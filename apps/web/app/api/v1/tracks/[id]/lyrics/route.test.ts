import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getPublicLyrics } = vi.hoisted(() => ({ getPublicLyrics: vi.fn() }));

vi.mock('@vire/db', () => ({
  db: {},
  DrizzleListenerTrackRepository: class {
    getPublicLyrics = getPublicLyrics;
  },
}));

import { GET } from './route';

const UUID = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ id: UUID }) };

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/tracks/[id]/lyrics', () => {
  it('400 when the track id is not a uuid', async () => {
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(400);
    expect(getPublicLyrics).not.toHaveBeenCalled();
  });

  it('returns null lyrics for a track with none', async () => {
    getPublicLyrics.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ lyrics: null });
  });

  it('returns the lyrics with a Cache-Control header', async () => {
    const lyrics = [{ t: 0, text: 'line' }];
    getPublicLyrics.mockResolvedValue(lyrics);
    const res = await GET(new Request('http://localhost'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ lyrics });
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60, stale-while-revalidate=300');
  });
});
