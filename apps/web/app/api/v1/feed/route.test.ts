import { describe, it, expect, vi, beforeEach } from 'vitest';
import { feedResponseSchema } from '@vire/api-contracts';
import { FEED_LIMIT, CANDIDATE_POOL } from '@vire/core';
import type { FeedCandidate } from '@vire/core';

const { candidates, freshCandidates, taste } = vi.hoisted(() => ({
  candidates: vi.fn(),
  freshCandidates: vi.fn(),
  taste: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleFeedRepository: class {
    candidates = candidates;
    freshCandidates = freshCandidates;
    taste = taste;
  },
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

function req(query = ''): Request {
  return new Request(`http://localhost/api/v1/feed${query}`);
}

function candidate(overrides: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    kind: 'RELEASE',
    id: 'r1',
    artistProfileId: 'artist-1',
    artistSlug: 'artist-1',
    artistName: 'Artist One',
    artistAvatarUrl: null,
    occurredAt: new Date('2026-01-01T00:00:00.000Z'),
    isFollowed: true,
    genres: [],
    moods: [],
    plays30d: 0,
    title: 'Title',
    coverUrl: null,
    hasExplicit: false,
    releaseType: 'ALBUM',
    body: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  taste.mockResolvedValue({ topArtistIds: [], topGenres: [], topMoods: [] });
  freshCandidates.mockResolvedValue([]);
  candidates.mockResolvedValue([]);
});

describe('GET /api/v1/feed', () => {
  it('401 without a session', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(candidates).not.toHaveBeenCalled();
  });

  it('200 with a session, response matches the contract', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    candidates.mockResolvedValue([candidate()]);

    const res = await GET(req());

    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = feedResponseSchema.parse(body);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]!.occurredAt).toBe('2026-01-01T00:00:00.000Z');
    expect(parsed.items[0]!.reason).toBe('follow');
  });

  it('candidate pool size reaches the repository regardless of the requested limit', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    await GET(req('?limit=3'));
    expect(candidates).toHaveBeenCalledWith('user-1', CANDIDATE_POOL);
  });

  it('default limit (FEED_LIMIT) reaches the fresh fallback when no limit is given', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    candidates.mockResolvedValue([candidate({ id: 'r1' })]);

    await GET(req());

    expect(freshCandidates).toHaveBeenCalledWith(['r1'], FEED_LIMIT - 1);
  });

  it('400 on limit=0', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await GET(req('?limit=0'));
    expect(res.status).toBe(400);
    expect(candidates).not.toHaveBeenCalled();
  });

  it('400 on limit=51', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await GET(req('?limit=51'));
    expect(res.status).toBe(400);
    expect(candidates).not.toHaveBeenCalled();
  });

  it('200 on limit=50 (upper bound inclusive)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await GET(req('?limit=50'));
    expect(res.status).toBe(200);
  });

  it('ignores userId in the query string — userId always comes from the session', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    await GET(req('?userId=other'));
    expect(candidates).toHaveBeenCalledWith('user-1', CANDIDATE_POOL);
    expect(candidates).not.toHaveBeenCalledWith('other', expect.anything());
  });
});
