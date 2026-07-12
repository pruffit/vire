import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findTrackById, findReleaseById, getMoods, setMoods } = vi.hoisted(() => ({
  findTrackById: vi.fn(),
  findReleaseById: vi.fn(),
  getMoods: vi.fn(),
  setMoods: vi.fn(),
}));
const { getActiveArtist } = vi.hoisted(() => ({ getActiveArtist: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/active-artist', () => ({ getActiveArtist }));
vi.mock('@vire/db', () => ({
  db: {},
  ALL_MOODS: ['CHILL', 'NIGHT', 'HYPE'],
  DrizzleTrackRepository: class {
    findById = findTrackById;
  },
  DrizzleReleaseRepository: class {
    findById = findReleaseById;
  },
  DrizzleTrackMoodsRepository: class {
    get = getMoods;
    set = setMoods;
  },
}));

import { auth } from '@/auth';
import { GET, PUT } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = 'track-1';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };

function putReq(body: unknown): Request {
  return new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/moods`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/tracks/[id]/moods', () => {
  it('404 when the track does not exist', async () => {
    findTrackById.mockResolvedValue(null);
    const res = await GET(new Request('http://localhost'), ctx);
    expect(res.status).toBe(404);
    expect(getMoods).not.toHaveBeenCalled();
  });

  it('returns the moods', async () => {
    findTrackById.mockResolvedValue({ id: TRACK_ID });
    getMoods.mockResolvedValue(['CHILL']);
    const res = await GET(new Request('http://localhost'), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ moods: ['CHILL'] });
  });
});

describe('PUT /api/v1/tracks/[id]/moods', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await PUT(putReq({ moods: ['CHILL'] }), ctx);
    expect(res.status).toBe(401);
  });

  it('403 when there is no active artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getActiveArtist.mockResolvedValue(null);
    const res = await PUT(putReq({ moods: ['CHILL'] }), ctx);
    expect(res.status).toBe(403);
  });

  it('400 on invalid moods', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getActiveArtist.mockResolvedValue({ id: 'artist-1' });
    const res = await PUT(putReq({ moods: ['NOT_A_MOOD'] }), ctx);
    expect(res.status).toBe(400);
    expect(setMoods).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getActiveArtist.mockResolvedValue({ id: 'artist-1' });
    findTrackById.mockResolvedValue(null);
    const res = await PUT(putReq({ moods: ['CHILL'] }), ctx);
    expect(res.status).toBe(404);
    expect(setMoods).not.toHaveBeenCalled();
  });

  it('403 when the track belongs to another artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getActiveArtist.mockResolvedValue({ id: 'artist-1' });
    findTrackById.mockResolvedValue({ id: TRACK_ID, releaseId: 'r1' });
    findReleaseById.mockResolvedValue({ id: 'r1', artistProfileId: 'other-artist' });
    const res = await PUT(putReq({ moods: ['CHILL'] }), ctx);
    expect(res.status).toBe(403);
    expect(setMoods).not.toHaveBeenCalled();
  });

  it('sets the moods when the track belongs to the active artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    getActiveArtist.mockResolvedValue({ id: 'artist-1' });
    findTrackById.mockResolvedValue({ id: TRACK_ID, releaseId: 'r1' });
    findReleaseById.mockResolvedValue({ id: 'r1', artistProfileId: 'artist-1' });
    const res = await PUT(putReq({ moods: ['CHILL', 'NIGHT'] }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ moods: ['CHILL', 'NIGHT'] });
    expect(setMoods).toHaveBeenCalledWith(TRACK_ID, ['CHILL', 'NIGHT']);
  });
});
