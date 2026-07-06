import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, findById, releaseFindById, getTrackSourceKey, analyzeAdd } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  findById: vi.fn(),
  releaseFindById: vi.fn(),
  getTrackSourceKey: vi.fn(),
  analyzeAdd: vi.fn(),
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
  getTrackSourceKey,
}));
vi.mock('@/lib/queue', () => ({ analyzeQueue: { add: analyzeAdd } }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function makeReq(): Request {
  return new Request(`http://localhost/api/v1/dashboard/tracks/${TRACK_ID}/analyze`, { method: 'POST' });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/dashboard/tracks/[id]/analyze', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(401);
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('400 on a malformed track id', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await POST(makeReq(), { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue(null);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(404);
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('403 when the track belongs to another artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'OTHER' });
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(403);
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('409 when the track has no source file', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'artist1' });
    getTrackSourceKey.mockResolvedValue(null);
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(409);
    expect(analyzeAdd).not.toHaveBeenCalled();
  });

  it('202 + enqueues for an owned track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'artist1' });
    getTrackSourceKey.mockResolvedValue('vault/tracks/1/source.flac');
    const res = await POST(makeReq(), ctx);
    expect(res.status).toBe(202);
    expect(analyzeAdd).toHaveBeenCalledWith({ trackId: TRACK_ID, flacKey: 'vault/tracks/1/source.flac' });
  });
});
