import { describe, it, expect, vi, beforeEach } from 'vitest';
import { friendsActivityResponseSchema } from '@vire/api-contracts';

const { friendsActivity } = vi.hoisted(() => ({
  friendsActivity: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@vire/db', () => ({
  db: {},
  DrizzleHomeBlocksRepository: class {
    friendsActivity = friendsActivity;
  },
}));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

function req(query = ''): Request {
  return new Request(`http://localhost/api/v1/home/friends-activity${query}`);
}

const actorA = { id: 'a', name: 'Аня', image: null };

beforeEach(() => {
  vi.clearAllMocks();
  friendsActivity.mockResolvedValue({ likes: [], follows: [], playlists: [] });
});

describe('GET /api/v1/home/friends-activity', () => {
  it('401 without a session', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(friendsActivity).not.toHaveBeenCalled();
  });

  it('200 with a session, empty activity — response matches the contract', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = friendsActivityResponseSchema.parse(body);
    expect(parsed.items).toEqual([]);
  });

  it('merges likes/follows/playlists sorted by recency, most recent first', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    friendsActivity.mockResolvedValue({
      likes: [{ actor: actorA, at: new Date('2026-01-01T00:00:00Z'), trackTitle: 'T', artistName: 'Ar', artistSlug: 'ar', releaseId: 'r' }],
      follows: [{ actor: actorA, at: new Date('2026-01-03T00:00:00Z'), artistName: 'Ar2', artistSlug: 'ar2' }],
      playlists: [{ actor: actorA, at: new Date('2026-01-02T00:00:00Z'), playlistId: 'p', title: 'P' }],
    });

    const res = await GET(req());
    const body = await res.json();
    const parsed = friendsActivityResponseSchema.parse(body);
    expect(parsed.items.map((i) => i.kind)).toEqual(['follow', 'playlist', 'like']);
    expect(parsed.items[0]!.at).toBe('2026-01-03T00:00:00.000Z');
  });

  it('surfaces a 500 when the repository fails — no silent empty-block degradation over HTTP', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    friendsActivity.mockRejectedValue(new Error('db down'));
    await expect(GET(req())).rejects.toThrow('db down');
  });

  it('ignores userId in the query string — userId always comes from the session', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'user-1' } } as never);
    await GET(req('?userId=other'));
    expect(friendsActivity).toHaveBeenCalledWith('user-1', expect.any(Number));
    expect(friendsActivity).not.toHaveBeenCalledWith('other', expect.anything());
  });
});
