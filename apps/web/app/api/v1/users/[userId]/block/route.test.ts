import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { ValidationError } from '@vire/core';

const { block, unblock } = vi.hoisted(() => ({ block: vi.fn(), unblock: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/blocks', () => ({ blockService: () => ({ block, unblock }) }));

import { auth } from '@/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { POST, DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedTooManyRequests = vi.mocked(tooManyRequests);

const OTHER_ID = '11111111-1111-1111-1111-111111111111';
const SELF_ID = '22222222-2222-2222-2222-222222222222';

const ctx = (id: string) => ({ params: Promise.resolve({ userId: id }) });
const req = () => new Request(`http://localhost/api/v1/users/${OTHER_ID}/block`, { method: 'POST' });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/users/[userId]/block', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req(), ctx(OTHER_ID));
    expect(res.status).toBe(401);
    expect(block).not.toHaveBeenCalled();
  });

  it('400 on invalid userId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await POST(req(), ctx('nope'));
    expect(res.status).toBe(400);
  });

  it('429 when rate limited', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 } as never);
    mockedTooManyRequests.mockReturnValueOnce(NextResponse.json({ error: 't' }, { status: 429 }) as never);
    const res = await POST(req(), ctx(OTHER_ID));
    expect(res.status).toBe(429);
  });

  it('422 on self-block', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    block.mockResolvedValue({ ok: false, error: new ValidationError('self') });
    const res = await POST(req(), ctx(SELF_ID));
    expect(res.status).toBe(422);
  });

  it('blocks the user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    block.mockResolvedValue({ ok: true, value: undefined });
    const res = await POST(req(), ctx(OTHER_ID));
    expect(res.status).toBe(200);
    expect(block).toHaveBeenCalledWith(SELF_ID, OTHER_ID);
  });
});

describe('DELETE /api/v1/users/[userId]/block', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(req(), ctx(OTHER_ID));
    expect(res.status).toBe(401);
    expect(unblock).not.toHaveBeenCalled();
  });

  it('unblocks the user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    unblock.mockResolvedValue({ ok: true, value: undefined });
    const res = await DELETE(req(), ctx(OTHER_ID));
    expect(res.status).toBe(200);
    expect(unblock).toHaveBeenCalledWith(SELF_ID, OTHER_ID);
  });
});
