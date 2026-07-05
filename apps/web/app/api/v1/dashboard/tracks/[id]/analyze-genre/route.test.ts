import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, findById, releaseFindById, analyzeGenreAdd } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  findById: vi.fn(),
  releaseFindById: vi.fn(),
  analyzeGenreAdd: vi.fn(),
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
}));
vi.mock('@/lib/queue', () => ({ analyzeGenreQueue: { add: analyzeGenreAdd } }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function makeReq(): Request {
  return new Request(`http://localhost/api/v1/dashboard/tracks/${TRACK_ID}/analyze-genre`, { method: 'POST' });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/dashboard/tracks/[id]/analyze-genre', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(401);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('400 on a malformed track id', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue(null);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('403 when the track belongs to another artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'OTHER' });
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeGenreAdd).not.toHaveBeenCalled();
  });

  it('202 + enqueues for an owned track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'artist1' });
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(202);
    expect(analyzeGenreAdd).toHaveBeenCalledWith({ trackId: TRACK_ID });
  });
});
