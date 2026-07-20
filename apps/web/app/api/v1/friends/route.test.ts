import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listFriends } = vi.hoisted(() => ({ listFriends: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/friends', () => ({ friendshipService: () => ({ listFriends }) }));

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

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.friends).toHaveLength(1);
    expect(listFriends).toHaveBeenCalledWith('u1');
  });
});
