import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatConversationsResponseSchema } from '@vire/api-contracts';

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
    listConversations.mockResolvedValue([{ id: 'c1', lastMessageAt: null }]);
    const res = await GET();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ conversations: [{ id: 'c1', lastMessageAt: null }] });
    expect(listConversations).toHaveBeenCalledWith(SELF_ID);
  });

  it('returns a schema-valid conversation with a mapped lastMessageAt', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    listConversations.mockResolvedValue([
      {
        id: 'c1',
        otherUserId: 'u1',
        otherUserName: 'Аня',
        otherUserImage: null,
        otherIkPub: null,
        lastMessageAt: new Date('2026-01-01T00:00:00.000Z'),
        lastMessageBody: 'ct',
        lastMessageNonce: 'nc',
        lastMessageSenderId: 'u1',
        unread: true,
      },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(body.conversations[0].lastMessageAt).toBe('2026-01-01T00:00:00.000Z');
    expect(chatConversationsResponseSchema.safeParse(body).success).toBe(true);
  });
});
