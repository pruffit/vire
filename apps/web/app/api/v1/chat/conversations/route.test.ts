import { describe, it, expect, vi, beforeEach } from 'vitest';

const { listConversations } = vi.hoisted(() => ({ listConversations: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/chat', () => ({ chatService: () => ({ listConversations }) }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);

const SELF_ID = '22222222-2222-2222-2222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/chat/conversations', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(listConversations).not.toHaveBeenCalled();
  });

  it('returns the conversation list', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    listConversations.mockResolvedValue([{ id: 'c1' }]);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ conversations: [{ id: 'c1' }] });
    expect(listConversations).toHaveBeenCalledWith(SELF_ID);
  });
});
