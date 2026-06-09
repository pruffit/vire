import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByUserId, createArtistPost } = vi.hoisted(() => ({
  findByUserId: vi.fn(),
  createArtistPost: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByUserId = findByUserId;
  },
  createArtistPost,
}));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/v1/dashboard/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/dashboard/posts', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(makeReq({ body: 'hi' }))).status).toBe(401);
  });

  it('403 when the user has no artist profile', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue(null);
    expect((await POST(makeReq({ body: 'hi' }))).status).toBe(403);
  });

  it('400 when body is empty', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(makeReq({ title: 'T', body: '   ' }));
    expect(res.status).toBe(400);
    expect(createArtistPost).not.toHaveBeenCalled();
  });

  it('400 when body exceeds max length', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    const res = await POST(makeReq({ body: 'x'.repeat(2001) }));
    expect(res.status).toBe(400);
    expect(createArtistPost).not.toHaveBeenCalled();
  });

  it('creates a post for the owning artist, trimming fields', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    createArtistPost.mockResolvedValue({ id: 'p1', title: 'Hi', body: 'Body', createdAt: new Date() });
    const res = await POST(makeReq({ title: '  Hi  ', body: '  Body  ' }));
    expect(res.status).toBe(201);
    expect(createArtistPost).toHaveBeenCalledWith({
      artistProfileId: 'artist1',
      title: 'Hi',
      body: 'Body',
    });
  });

  it('stores null title when omitted', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByUserId.mockResolvedValue({ id: 'artist1' });
    createArtistPost.mockResolvedValue({ id: 'p2', title: null, body: 'Body', createdAt: new Date() });
    await POST(makeReq({ body: 'Body' }));
    expect(createArtistPost).toHaveBeenCalledWith(
      expect.objectContaining({ title: null, body: 'Body' }),
    );
  });
});
