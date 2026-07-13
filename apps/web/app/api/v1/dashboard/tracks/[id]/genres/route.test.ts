import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, trackFindById, releaseFindById, setTrackGenres } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  trackFindById: vi.fn(),
  releaseFindById: vi.fn(),
  setTrackGenres: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleTrackRepository: class {
    findById = trackFindById;
  },
  DrizzleReleaseRepository: class {
    findById = releaseFindById;
  },
  setTrackGenres,
  ALL_TRACK_GENRES: ['ELECTRONIC', 'HIPHOP', 'ROCK'],
}));

import { auth } from '@/auth';
import { PUT } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function req(body: unknown | string): Request {
  return new Request(`http://localhost/api/v1/dashboard/tracks/${TRACK_ID}/genres`, {
    method: 'PUT',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('PUT /api/v1/dashboard/tracks/[id]/genres', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await PUT(req({ genres: ['ROCK'] }), ctx);
    expect(res.status).toBe(401);
    expect(findByUserId).not.toHaveBeenCalled();
  });

  it('400 on a malformed track id', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const badCtx = { params: Promise.resolve({ id: 'not-a-uuid' }) };
    const res = await PUT(req({ genres: ['ROCK'] }), badCtx);
    expect(res.status).toBe(400);
    expect(findByUserId).not.toHaveBeenCalled();
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    const res = await PUT(req({ genres: ['ROCK'] }), ctx);
    expect(res.status).toBe(403);
    expect(trackFindById).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    trackFindById.mockResolvedValue(null);
    const res = await PUT(req({ genres: ['ROCK'] }), ctx);
    expect(res.status).toBe(404);
  });

  it('403 when the track’s release belongs to another artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    trackFindById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'other' });
    const res = await PUT(req({ genres: ['ROCK'] }), ctx);
    expect(res.status).toBe(403);
    expect(setTrackGenres).not.toHaveBeenCalled();
  });

  it('400 on malformed JSON', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    trackFindById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'artist1' });
    const res = await PUT(req('{bad json'), ctx);
    expect(res.status).toBe(400);
    expect(setTrackGenres).not.toHaveBeenCalled();
  });

  it('400 when a genre is outside the allowed enum', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    trackFindById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'artist1' });
    const res = await PUT(req({ genres: ['NOTAGENRE'] }), ctx);
    expect(res.status).toBe(400);
    expect(setTrackGenres).not.toHaveBeenCalled();
  });

  it('400 when more than 3 genres are sent', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    trackFindById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'artist1' });
    const res = await PUT(req({ genres: ['ELECTRONIC', 'HIPHOP', 'ROCK', 'ELECTRONIC'] }), ctx);
    expect(res.status).toBe(400);
    expect(setTrackGenres).not.toHaveBeenCalled();
  });

  it('happy path: sets the genres and echoes them back', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    trackFindById.mockResolvedValue({ id: TRACK_ID, releaseId: 'rel1' });
    releaseFindById.mockResolvedValue({ id: 'rel1', artistProfileId: 'artist1' });
    const res = await PUT(req({ genres: ['ROCK', 'HIPHOP'] }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ genres: ['ROCK', 'HIPHOP'] });
    expect(setTrackGenres).toHaveBeenCalledWith(TRACK_ID, ['ROCK', 'HIPHOP']);
  });
});
