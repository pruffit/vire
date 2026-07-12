import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findBySlug, follow, unfollow } = vi.hoisted(() => ({
  findBySlug: vi.fn(),
  follow: vi.fn(),
  unfollow: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findBySlug = findBySlug;
  },
  DrizzleFollowRepository: class {
    follow = follow;
    unfollow = unfollow;
  },
}));

import { auth } from '@/auth';
import { POST, DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const ctx = { params: Promise.resolve({ slug: 'some-artist' }) };
const req = () => new Request('http://localhost/api/v1/artists/some-artist/follow', { method: 'POST' });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/artists/[slug]/follow', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(401);
    expect(follow).not.toHaveBeenCalled();
  });

  it('404 when the artist does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findBySlug.mockResolvedValue(null);
    const res = await POST(req(), ctx);
    expect(res.status).toBe(404);
    expect(follow).not.toHaveBeenCalled();
  });

  it('follows the artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findBySlug.mockResolvedValue({ id: 'artist1' });
    const res = await POST(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ following: true });
    expect(follow).toHaveBeenCalledWith('u1', 'artist1');
  });
});

describe('DELETE /api/v1/artists/[slug]/follow', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(401);
    expect(unfollow).not.toHaveBeenCalled();
  });

  it('unfollows the artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findBySlug.mockResolvedValue({ id: 'artist1' });
    const res = await DELETE(req(), ctx);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ following: false });
    expect(unfollow).toHaveBeenCalledWith('u1', 'artist1');
  });
});
