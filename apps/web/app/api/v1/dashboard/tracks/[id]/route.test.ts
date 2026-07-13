import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, updateTrack, deleteTrack } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  updateTrack: vi.fn(),
  deleteTrack: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleReleaseRepository: class {},
  DrizzleTrackRepository: class {},
}));
vi.mock('@vire/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vire/core')>();
  return {
    ...actual,
    TrackService: class {
      updateTrack = updateTrack;
      deleteTrack = deleteTrack;
    },
  };
});
vi.mock('@/lib/queue', () => ({ transcodeQueue: {} }));

import { auth } from '@/auth';
import { NotFoundError } from '@vire/core';
import { PATCH, DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };
const badCtx = { params: Promise.resolve({ id: 'not-a-uuid' }) };

function patchReq(body: unknown | string): Request {
  return new Request(`http://localhost/api/v1/dashboard/tracks/${TRACK_ID}`, {
    method: 'PATCH',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function deleteReq(): Request {
  return new Request(`http://localhost/api/v1/dashboard/tracks/${TRACK_ID}`, { method: 'DELETE' });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
  findByUserId.mockResolvedValue({ id: 'artist1' });
});

describe('PATCH /api/v1/dashboard/tracks/[id]', () => {
  it('400 on a malformed track id (checked before auth)', async () => {
    const res = await PATCH(patchReq({ title: 'New' }), badCtx);
    expect(res.status).toBe(400);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await PATCH(patchReq({ title: 'New' }), ctx);
    expect(res.status).toBe(401);
    expect(updateTrack).not.toHaveBeenCalled();
  });

  it('403 when the user has no artist profile', async () => {
    findByUserId.mockResolvedValue(null);
    const res = await PATCH(patchReq({ title: 'New' }), ctx);
    expect(res.status).toBe(403);
    expect(updateTrack).not.toHaveBeenCalled();
  });

  it('400 on malformed JSON', async () => {
    const res = await PATCH(patchReq('{bad json'), ctx);
    expect(res.status).toBe(400);
    expect(updateTrack).not.toHaveBeenCalled();
  });

  it('400 when the patch is empty', async () => {
    const res = await PATCH(patchReq({}), ctx);
    expect(res.status).toBe(400);
    expect(updateTrack).not.toHaveBeenCalled();
  });

  it('400 on an invalid title', async () => {
    const res = await PATCH(patchReq({ title: '   ' }), ctx);
    expect(res.status).toBe(400);
    expect(updateTrack).not.toHaveBeenCalled();
  });

  it('400 on a bpm outside the accepted range', async () => {
    const res = await PATCH(patchReq({ bpm: 999 }), ctx);
    expect(res.status).toBe(400);
    expect(updateTrack).not.toHaveBeenCalled();
  });

  it('400 when credits is not an array', async () => {
    const res = await PATCH(patchReq({ credits: 'nope' }), ctx);
    expect(res.status).toBe(400);
    expect(updateTrack).not.toHaveBeenCalled();
  });

  it('maps a NotFoundError result to 404', async () => {
    updateTrack.mockResolvedValue({ ok: false, error: new NotFoundError('Track', TRACK_ID) });
    const res = await PATCH(patchReq({ title: 'New' }), ctx);
    expect(res.status).toBe(404);
  });

  it('maps a non-NotFoundError result to 403', async () => {
    updateTrack.mockResolvedValue({ ok: false, error: new Error('Forbidden: track does not belong to this artist') });
    const res = await PATCH(patchReq({ title: 'New' }), ctx);
    expect(res.status).toBe(403);
  });

  it('happy path: updates the track', async () => {
    const track = { id: TRACK_ID, title: 'New' };
    updateTrack.mockResolvedValue({ ok: true, value: track });
    const res = await PATCH(patchReq({ title: 'New' }), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ track });
    expect(updateTrack).toHaveBeenCalledWith({
      trackId: TRACK_ID,
      artistProfileId: 'artist1',
      patch: { title: 'New' },
    });
  });
});

describe('DELETE /api/v1/dashboard/tracks/[id]', () => {
  it('400 on a malformed track id (checked before auth)', async () => {
    const res = await DELETE(deleteReq(), badCtx);
    expect(res.status).toBe(400);
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(401);
    expect(deleteTrack).not.toHaveBeenCalled();
  });

  it('403 when the user has no artist profile', async () => {
    findByUserId.mockResolvedValue(null);
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(403);
    expect(deleteTrack).not.toHaveBeenCalled();
  });

  it('maps a NotFoundError result to 404', async () => {
    deleteTrack.mockResolvedValue({ ok: false, error: new NotFoundError('Track', TRACK_ID) });
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(404);
  });

  it('maps a non-NotFoundError result to 403', async () => {
    deleteTrack.mockResolvedValue({ ok: false, error: new Error('Forbidden') });
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(403);
  });

  it('happy path: deletes the track', async () => {
    deleteTrack.mockResolvedValue({ ok: true, value: undefined });
    const res = await DELETE(deleteReq(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteTrack).toHaveBeenCalledWith({ trackId: TRACK_ID, artistProfileId: 'artist1' });
  });
});
