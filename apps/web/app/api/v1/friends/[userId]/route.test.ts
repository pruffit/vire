import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';

const { unfriend } = vi.hoisted(() => ({
  unfriend: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/friends', () => ({
  friendshipService: () => ({ unfriend }),
}));

import { auth } from '@/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { DELETE } from './route';

const mockedAuth = vi.mocked(auth);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedTooManyRequests = vi.mocked(tooManyRequests);
const OTHER_ID = '11111111-1111-1111-1111-111111111111';
const SELF_ID = '22222222-2222-2222-2222-222222222222';
const ctx = (id: string) => ({ params: Promise.resolve({ userId: id }) });
const req = () => new Request(`http://localhost/api/v1/friends/${OTHER_ID}`, { method: 'DELETE' });

beforeEach(() => vi.clearAllMocks());

describe('DELETE /api/v1/friends/[userId]', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await DELETE(req(), ctx(OTHER_ID));
    expect(res.status).toBe(401);
    expect(unfriend).not.toHaveBeenCalled();
  });

  it('400 on invalid userId', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await DELETE(req(), ctx('nope'));
    expect(res.status).toBe(400);
    expect(unfriend).not.toHaveBeenCalled();
  });

  it('429 when rate limited', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 } as never);
    mockedTooManyRequests.mockReturnValueOnce(NextResponse.json({ error: 't' }, { status: 429 }) as never);
    const res = await DELETE(req(), ctx(OTHER_ID));
    expect(res.status).toBe(429);
    expect(unfriend).not.toHaveBeenCalled();
  });

  it('removes the friendship edge', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    unfriend.mockResolvedValue({ ok: true, value: undefined });
    const res = await DELETE(req(), ctx(OTHER_ID));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(unfriend).toHaveBeenCalledWith(SELF_ID, OTHER_ID);
  });
});
