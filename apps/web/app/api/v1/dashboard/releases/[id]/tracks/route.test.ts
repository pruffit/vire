import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, findWithTracks } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  findWithTracks: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  DrizzleReleaseRepository: class {
    findWithTracks = findWithTracks;
  },
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const RELEASE_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';
const ctx = { params: Promise.resolve({ id: RELEASE_ID }) };

function req(): Request {
  return new Request(`http://localhost/api/v1/dashboard/releases/${RELEASE_ID}/tracks`);
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/dashboard/releases/[id]/tracks', () => {
  it('400 on a malformed release id', async () => {
    const res = await GET(req(), { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
  });

  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await GET(req(), ctx)).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(403);
  });

  it('404 when the release does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findWithTracks.mockResolvedValue(null);
    expect((await GET(req(), ctx)).status).toBe(404);
  });

  it('403 when the release belongs to another artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findWithTracks.mockResolvedValue({ release: { artistProfileId: 'OTHER' }, tracks: [] });
    expect((await GET(req(), ctx)).status).toBe(403);
  });

  it('returns id + status for each track of an owned release', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    findWithTracks.mockResolvedValue({
      release: { artistProfileId: 'artist1' },
      tracks: [
        { id: 't1', title: 'A', status: 'READY' },
        { id: 't2', title: 'B', status: 'PROCESSING' },
      ],
    });
    const res = await GET(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      tracks: [
        { id: 't1', status: 'READY' },
        { id: 't2', status: 'PROCESSING' },
      ],
    });
  });
});
