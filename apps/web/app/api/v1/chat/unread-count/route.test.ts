import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatUnreadCountResponseSchema } from '@vire/api-contracts';

const { countUnread } = vi.hoisted(() => ({ countUnread: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/chat', () => ({ chatService: () => ({ countUnread }) }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

const SELF_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/chat/unread-count', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(countUnread).not.toHaveBeenCalled();
  });

  it('returns the unread conversation count', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    countUnread.mockResolvedValue(4);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ count: 4 });
    expect(chatUnreadCountResponseSchema.safeParse(body).success).toBe(true);
    expect(countUnread).toHaveBeenCalledWith(SELF_ID);
  });
});
