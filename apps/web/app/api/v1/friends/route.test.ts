import { describe, it, expect, vi, beforeEach } from 'vitest';
import { friendsResponseSchema } from '@vire/api-contracts';

const { listFriends, listIncoming } = vi.hoisted(() => ({ listFriends: vi.fn(), listIncoming: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/friends', () => ({ friendshipService: () => ({ listFriends, listIncoming }) }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/friends', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const res = await GET();

    expect(res.status).toBe(401);
    expect(listFriends).not.toHaveBeenCalled();
  });

  it('returns the friend list for the current user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    listFriends.mockResolvedValue([{ id: 'f1', name: 'Alex', image: null, since: new Date() }]);
    listIncoming.mockResolvedValue([]);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.friends).toHaveLength(1);
    expect(listFriends).toHaveBeenCalledWith('u1');
  });

  it('ответ соответствует контракту: since/requestedAt — ISO-строки, а не сырой Date', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const since = new Date('2026-08-16T10:00:00.000Z');
    const requestedAt = new Date('2026-08-20T10:00:00.000Z');
    listFriends.mockResolvedValue([{ id: 'f1', name: 'Alex', image: null, since }]);
    listIncoming.mockResolvedValue([{ id: 'p1', name: 'Sam', image: null, requestedAt }]);

    const body = await (await GET()).json();

    expect(friendsResponseSchema.safeParse(body).success).toBe(true);
    expect(body.friends[0].since).toBe(since.toISOString());
    expect(body.incoming[0].requestedAt).toBe(requestedAt.toISOString());
  });

  it('returns incoming requests alongside friends', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    listFriends.mockResolvedValue([]);
    listIncoming.mockResolvedValue([
      { id: 'p1', name: 'Sam', image: null, requestedAt: new Date() },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.incoming).toHaveLength(1);
    expect(listIncoming).toHaveBeenCalledWith('u1');
  });
});
