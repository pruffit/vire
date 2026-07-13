import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, getArtistTrackIds, countListeningMany } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  getArtistTrackIds: vi.fn(),
  countListeningMany: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  getArtistTrackIds,
}));
vi.mock('@/lib/presence', () => ({ countListeningMany }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const req = () => new Request('http://localhost/api/v1/dashboard/live');

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/dashboard/live', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(getArtistTrackIds).not.toHaveBeenCalled();
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(getArtistTrackIds).not.toHaveBeenCalled();
  });

  it('degrades to count:0 when Redis (or track lookup) fails', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    getArtistTrackIds.mockResolvedValue(['t1', 't2']);
    countListeningMany.mockRejectedValue(new Error('redis down'));
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ count: 0 });
  });

  it('happy path: returns the live listener count across the artist’s tracks', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    getArtistTrackIds.mockResolvedValue(['t1', 't2']);
    countListeningMany.mockResolvedValue(7);
    const res = await GET(req());
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ count: 7 });
    expect(getArtistTrackIds).toHaveBeenCalledWith('artist1');
    expect(countListeningMany).toHaveBeenCalledWith(['t1', 't2']);
  });
});
