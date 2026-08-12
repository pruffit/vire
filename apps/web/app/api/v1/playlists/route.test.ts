import { describe, it, expect, vi, beforeEach } from 'vitest';
import { playlistListResponseSchema, createPlaylistResponseSchema } from '@vire/api-contracts';

const { listByUser, trackMembership, create } = vi.hoisted(() => ({
  listByUser: vi.fn(),
  trackMembership: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/playlist-cover-storage', () => ({ playlistCoverStorage: { upload: vi.fn() } }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzlePlaylistRepository: class {
    listByUser = listByUser;
    trackMembership = trackMembership;
    create = create;
  },
  DrizzleBlockRepository: class {},
  DrizzleNotificationRepository: class {},
}));

import { auth } from '@/auth';
import { GET, POST } from './route';
const mockedAuth = vi.mocked(auth);

const TRACK = '11111111-1111-4111-8111-111111111111';

function makeReq(url = 'http://localhost/api/v1/playlists'): Request {
  return new Request(url, { method: 'GET' });
}

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/playlists', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await GET(makeReq())).status).toBe(401);
  });

  it('200 returns playlists without trackId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    listByUser.mockResolvedValue([{
      id: 'p1', title: 'A', visibility: 'PRIVATE', trackCount: 0, coverUrl: null,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    }]);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.playlists).toHaveLength(1);
    expect(body.inPlaylists).toBeUndefined();
    expect(trackMembership).not.toHaveBeenCalled();
    expect(playlistListResponseSchema.safeParse(body).success).toBe(true);
  });

  it('200 includes inPlaylists when trackId is a valid uuid', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    listByUser.mockResolvedValue([{
      id: 'p1', title: 'A', visibility: 'PRIVATE', trackCount: 1, coverUrl: null,
      createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    }]);
    trackMembership.mockResolvedValue(['p1']);
    const res = await GET(makeReq(`http://localhost/api/v1/playlists?trackId=${TRACK}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inPlaylists).toEqual(['p1']);
    expect(trackMembership).toHaveBeenCalledWith('u1', TRACK);
    expect(playlistListResponseSchema.safeParse(body).success).toBe(true);
  });

  it('400 when trackId is not a uuid', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const res = await GET(makeReq('http://localhost/api/v1/playlists?trackId=nope'));
    expect(res.status).toBe(400);
    expect(trackMembership).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/playlists', () => {
  it('401 unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const req = new Request('http://localhost/api/v1/playlists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'X' }),
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('400 on invalid title', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const req = new Request('http://localhost/api/v1/playlists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: '' }),
    });
    expect((await POST(req)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('201 creates the playlist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    create.mockResolvedValue({ id: 'p1', title: 'New', visibility: 'PRIVATE', trackCount: 0, coverUrl: null, createdAt: new Date(), updatedAt: new Date() });
    const req = new Request('http://localhost/api/v1/playlists', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'New' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ id: 'p1' });
    expect(createPlaylistResponseSchema.safeParse(body).success).toBe(true);
    expect(create).toHaveBeenCalledWith('u1', 'New');
  });
});
