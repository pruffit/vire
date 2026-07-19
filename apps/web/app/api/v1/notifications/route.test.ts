import { describe, it, expect, vi, beforeEach } from 'vitest';

const { list, countUnread } = vi.hoisted(() => ({ list: vi.fn(), countUnread: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/notifications', () => ({ notificationService: () => ({ list, countUnread }) }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const SELF_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/notifications', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(list).not.toHaveBeenCalled();
  });

  it('returns notifications and unread count', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    list.mockResolvedValue([{ id: 'n1' }]);
    countUnread.mockResolvedValue(3);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ notifications: [{ id: 'n1' }], unread: 3 });
    expect(list).toHaveBeenCalledWith(SELF_ID, 20);
  });
});
