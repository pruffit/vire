import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { ValidationError, ForbiddenError } from '@vire/core';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/chat', () => ({ chatService: () => ({ send }) }));

import { auth } from '@/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedTooManyRequests = vi.mocked(tooManyRequests);

const OTHER_ID = '11111111-1111-1111-1111-111111111111';
const SELF_ID = '22222222-2222-2222-2222-222222222222';

const req = (body: unknown) =>
  new Request('http://localhost/api/v1/chat/messages', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/chat/messages', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req({ toUserId: OTHER_ID, ciphertext: 'ct', nonce: 'nc' }));
    expect(res.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it('400 on invalid body (bad uuid)', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await POST(req({ toUserId: 'nope', ciphertext: 'ct', nonce: 'nc' }));
    expect(res.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('400 on missing ciphertext', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await POST(req({ toUserId: OTHER_ID, ciphertext: '', nonce: 'nc' }));
    expect(res.status).toBe(400);
  });

  it('429 when rate limited', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 } as never);
    mockedTooManyRequests.mockReturnValueOnce(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 }) as never,
    );
    const res = await POST(req({ toUserId: OTHER_ID, ciphertext: 'ct', nonce: 'nc' }));
    expect(res.status).toBe(429);
    expect(send).not.toHaveBeenCalled();
  });

  it('403 when not a friend', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    send.mockResolvedValue({ ok: false, error: new ForbiddenError('Написать можно только другу') });
    const res = await POST(req({ toUserId: OTHER_ID, ciphertext: 'ct', nonce: 'nc' }));
    expect(res.status).toBe(403);
  });

  it('422 on validation error', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    send.mockResolvedValue({ ok: false, error: new ValidationError('Нельзя написать самому себе') });
    const res = await POST(req({ toUserId: OTHER_ID, ciphertext: 'ct', nonce: 'nc' }));
    expect(res.status).toBe(422);
  });

  it('sends and returns the message', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID, name: 'Аня' } } as never);
    send.mockResolvedValue({ ok: true, value: { conversationId: 'c1', message: { id: 'm1' } } });
    const res = await POST(req({ toUserId: OTHER_ID, ciphertext: 'ct', nonce: 'nc' }));
    expect(res.status).toBe(200);
    expect(send).toHaveBeenCalledWith(SELF_ID, OTHER_ID, { ciphertext: 'ct', nonce: 'nc' }, 'Аня');
  });
});
