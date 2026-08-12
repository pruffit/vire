import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationsResponseSchema } from '@vire/api-contracts';

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
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    list.mockResolvedValue([
      { id: 'n1', type: 'FRIEND_REQUEST', actorId: 'u1', actorName: 'Аня', actorImage: null, entityId: null, createdAt, readAt: null },
    ]);
    countUnread.mockResolvedValue(3);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      notifications: [
        { id: 'n1', type: 'FRIEND_REQUEST', actorId: 'u1', actorName: 'Аня', actorImage: null, entityId: null, createdAt: createdAt.toISOString(), readAt: null },
      ],
      unread: 3,
    });
    expect(notificationsResponseSchema.safeParse(body).success).toBe(true);
    expect(list).toHaveBeenCalledWith(SELF_ID, 20);
  });
});
