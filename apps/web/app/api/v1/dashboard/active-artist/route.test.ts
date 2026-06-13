import { describe, it, expect, vi, beforeEach } from 'vitest';

const { findByIdForUser } = vi.hoisted(() => ({ findByIdForUser: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleArtistRepository: class {
    findByIdForUser = findByIdForUser;
  },
}));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const ARTIST_ID = '1321eb20-c9e6-4d95-b4e7-7e6a08fc8cf9';

function req(body: unknown): Request {
  return new Request('http://localhost/api/v1/dashboard/active-artist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/dashboard/active-artist', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    expect((await POST(req({ artistId: ARTIST_ID }))).status).toBe(401);
  });

  it('400 on a malformed artistId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    expect((await POST(req({ artistId: 'nope' }))).status).toBe(400);
  });

  it('403 when the artist does not belong to the user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByIdForUser.mockResolvedValue(null);
    expect((await POST(req({ artistId: ARTIST_ID }))).status).toBe(403);
  });

  it('sets the cookie when the user owns the artist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    findByIdForUser.mockResolvedValue({ id: ARTIST_ID, slug: 'neon' });
    const res = await POST(req({ artistId: ARTIST_ID }));
    expect(res.status).toBe(200);
    expect(findByIdForUser).toHaveBeenCalledWith(ARTIST_ID, 'u1');
    expect(res.headers.get('set-cookie')).toContain('vire_active_artist=');
  });
});
