import { describe, it, expect, vi, beforeEach } from 'vitest';

const { likeTrack, unlikeTrack, trackExists } = vi.hoisted(() => ({
  likeTrack: vi.fn(),
  unlikeTrack: vi.fn(),
  trackExists: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({ likeTrack, unlikeTrack, trackExists }));

import { auth } from '@/auth';
import { POST, DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = 'track-1';
const ctx = { params: Promise.resolve({ id: TRACK_ID }) };
const req = () => new Request(`http://localhost/api/v1/tracks/${TRACK_ID}/like`, { method: 'POST' });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/tracks/[id]/like', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(401);
    expect(likeTrack).not.toHaveBeenCalled();
  });

  it('404 when the track does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    trackExists.mockResolvedValue(false);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
    expect(likeTrack).not.toHaveBeenCalled();
  });

  it('likes the track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    trackExists.mockResolvedValue(true);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ liked: true });
    expect(likeTrack).toHaveBeenCalledWith('u1', TRACK_ID);
  });
});

describe('DELETE /api/v1/tracks/[id]/like', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(401);
    expect(unlikeTrack).not.toHaveBeenCalled();
  });

  it('unlikes the track', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ liked: false });
    expect(unlikeTrack).toHaveBeenCalledWith('u1', TRACK_ID);
  });
});
