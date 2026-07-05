import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, findById, releaseFindById, getGenreSuggestionsSnapshot } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  findById: vi.fn(),
  releaseFindById: vi.fn(),
  getGenreSuggestionsSnapshot: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleTrackRepository: class {
    findById = findById;
  },
  DrizzleReleaseRepository: class {
    findById = releaseFindById;
  },
  getGenreSuggestionsSnapshot,
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function makeReq(): Request {
  return new Request(`http://localhost/api/v1/dashboard/tracks/${TRACK_ID}/genre-suggestions`);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/dashboard/tracks/[id]/genre-suggestions', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(401);
  });

  it('400 on a malformed track id', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await GET(makeReq(), { params: Promise.resolve({ id: 'nope' }) });
    expect(res.status).toBe(400);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(403);
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue(null);
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(404);
  });

  it('403 when the track belongs to another artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'OTHER' });
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(403);
  });

  it('returns the current snapshot for an owned track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'artist1' });
    getGenreSuggestionsSnapshot.mockResolvedValue({
      suggestions: [{ genre: 'TECHNO', confidence: 0.8 }],
      updatedAt: '2026-07-05T00:00:00.000Z',
    });
    const res = await GET(makeReq(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      suggestions: [{ genre: 'TECHNO', confidence: 0.8 }],
      updatedAt: '2026-07-05T00:00:00.000Z',
    });
  });
});
