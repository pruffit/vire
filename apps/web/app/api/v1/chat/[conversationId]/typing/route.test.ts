import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError } from '@vire/core';
import { okResponseSchema } from '@vire/api-contracts';

const { getConversationMeta, publish } = vi.hoisted(() => ({
  getConversationMeta: vi.fn(),
  publish: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/chat', () => ({ chatService: () => ({ getConversationMeta }) }));
vi.mock('@/lib/realtime', () => ({ publish }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);

const SELF_ID = '22222222-2222-2222-2222-222222222222';
const OTHER_ID = '11111111-1111-1111-1111-111111111111';
const CONV_ID = '33333333-3333-3333-3333-333333333333';

const ctx = (id: string) => ({ params: Promise.resolve({ conversationId: id }) });
const req = () => new Request(`http://localhost/api/v1/chat/${CONV_ID}/typing`, { method: 'POST' });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/chat/[conversationId]/typing', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req(), ctx(CONV_ID));
    expect(res.status).toBe(401);
    expect(publish).not.toHaveBeenCalled();
  });

  it('400 on invalid conversationId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await POST(req(), ctx('nope'));
    expect(res.status).toBe(400);
  });

  it('404 when not a participant', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    getConversationMeta.mockResolvedValue({ ok: false, error: new NotFoundError('Conversation', CONV_ID) });
    const res = await POST(req(), ctx(CONV_ID));
    expect(res.status).toBe(404);
    expect(publish).not.toHaveBeenCalled();
  });

  it('403 when forbidden', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    getConversationMeta.mockResolvedValue({ ok: false, error: new ForbiddenError('Not a participant') });
    const res = await POST(req(), ctx(CONV_ID));
    expect(res.status).toBe(403);
    expect(publish).not.toHaveBeenCalled();
  });

  it('publishes chat:typing to the other participant', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    getConversationMeta.mockResolvedValue({ ok: true, value: { otherUserId: OTHER_ID, otherLastReadAt: null } });
    const res = await POST(req(), ctx(CONV_ID));
    expect(res.status).toBe(200);
    expect(okResponseSchema.safeParse(await res.json()).success).toBe(true);
    expect(publish).toHaveBeenCalledWith(OTHER_ID, { type: 'chat:typing', conversationId: CONV_ID, userId: SELF_ID });
  });
});
