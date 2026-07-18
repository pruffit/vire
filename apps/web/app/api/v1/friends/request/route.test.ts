import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { NotFoundError, ValidationError } from '@vire/core';

const { request } = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/friends', () => ({
  friendshipService: () => ({ request }),
}));

import { auth } from '@/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedTooManyRequests = vi.mocked(tooManyRequests);

const OTHER_ID = '11111111-1111-1111-1111-111111111111';
const SELF_ID = '22222222-2222-2222-2222-222222222222';

const req = (body: unknown) =>
  new Request('http://localhost/api/v1/friends/request', {
    method: 'POST',
    body: JSON.stringify(body),
  });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/friends/request', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req({ userId: OTHER_ID }));
    expect(res.status).toBe(401);
    expect(request).not.toHaveBeenCalled();
  });

  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await POST(req({ userId: 'not-a-uuid' }));
    expect(res.status).toBe(400);
    expect(request).not.toHaveBeenCalled();
  });

  it('429 when rate limited', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 } as never);
    mockedTooManyRequests.mockReturnValueOnce(
      NextResponse.json({ error: 'Too many requests' }, { status: 429 }) as never,
    );
    const res = await POST(req({ userId: OTHER_ID }));
    expect(res.status).toBe(429);
    expect(mockedRateLimit).toHaveBeenCalledWith(`friend-request:${SELF_ID}`, 30, 60);
    expect(request).not.toHaveBeenCalled();
  });

  it('creates an outgoing request', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    request.mockResolvedValue({ ok: true, value: 'OUTGOING' });
    const res = await POST(req({ userId: OTHER_ID }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: 'OUTGOING' });
    expect(request).toHaveBeenCalledWith(SELF_ID, OTHER_ID);
  });

  it('404 when the target user does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    request.mockResolvedValue({ ok: false, error: new NotFoundError('User', OTHER_ID) });
    const res = await POST(req({ userId: OTHER_ID }));
    expect(res.status).toBe(404);
  });

  it('422 when requesting friendship with self', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    request.mockResolvedValue({
      ok: false,
      error: new ValidationError('Нельзя добавить в друзья самого себя'),
    });
    const res = await POST(req({ userId: SELF_ID }));
    expect(res.status).toBe(422);
    expect(request).toHaveBeenCalledWith(SELF_ID, SELF_ID);
  });
});
