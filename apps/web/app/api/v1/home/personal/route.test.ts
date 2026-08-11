import { describe, it, expect, vi, beforeEach } from 'vitest';
import { personalBlockResponseSchema } from '@vire/api-contracts';

const { recentlyPlayed, personalTrackPicks } = vi.hoisted(() => ({
  recentlyPlayed: vi.fn(),
  personalTrackPicks: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleHomeBlocksRepository: class {
    recentlyPlayed = recentlyPlayed;
    personalTrackPicks = personalTrackPicks;
  },
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

function req(query = ''): Request {
  return new Request(`http://localhost/api/v1/home/personal${query}`);
}

function makeTrack(overrides?: Record<string, unknown>) {
  return {
    id: 'track-1',
    title: 'Title',
    artistName: 'Artist',
    artistSlug: 'artist',
    releaseId: 'release-1',
    coverUrl: null,
    accentColor: null,
    isExplicit: false,
    plays: 0,
    version: null,
    feat: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  recentlyPlayed.mockResolvedValue([]);
  personalTrackPicks.mockResolvedValue([]);
});

describe('GET /api/v1/home/personal', () => {
  it('401 without a session', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(recentlyPlayed).not.toHaveBeenCalled();
  });

  it('200 with a session, response matches the contract', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    recentlyPlayed.mockResolvedValue([makeTrack({ id: 'r1' })]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = personalBlockResponseSchema.parse(body);
    expect(parsed.recentlyPlayed.map((t) => t.id)).toEqual(['r1']);
    expect(parsed.personalPicks).toEqual([]);
  });

  it('deduplicates personal picks against recently-played and hides them below the 4-item minimum', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    recentlyPlayed.mockResolvedValue([makeTrack({ id: 'r1' })]);
    personalTrackPicks.mockResolvedValue([makeTrack({ id: 'r1' }), makeTrack({ id: 'p1' }), makeTrack({ id: 'p2' })]);

    const res = await GET(req());
    const body = await res.json();
    const parsed = personalBlockResponseSchema.parse(body);
    // r1 удалён дедупом, остаётся 2 < 4 — блок скрыт
    expect(parsed.personalPicks).toEqual([]);
  });

  it('shows personal picks once 4 remain after dedup', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    personalTrackPicks.mockResolvedValue([
      makeTrack({ id: 'p1' }), makeTrack({ id: 'p2' }), makeTrack({ id: 'p3' }), makeTrack({ id: 'p4' }),
    ]);

    const res = await GET(req());
    const body = await res.json();
    const parsed = personalBlockResponseSchema.parse(body);
    expect(parsed.personalPicks.map((t) => t.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('surfaces a 500 when the repository fails — no silent empty-block degradation over HTTP', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    recentlyPlayed.mockRejectedValue(new Error('db down'));
    await expect(GET(req())).rejects.toThrow('db down');
  });

  it('ignores userId in the query string — userId always comes from the session', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    await GET(req('?userId=other'));
    expect(recentlyPlayed).toHaveBeenCalledWith('user-1', expect.any(Number));
    expect(recentlyPlayed).not.toHaveBeenCalledWith('other', expect.anything());
  });
});
