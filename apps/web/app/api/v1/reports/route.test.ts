import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { ValidationError, ConflictError } from '@vire/core';

const { submit } = vi.hoisted(() => ({ submit: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(),
}));
vi.mock('@/lib/reports', () => ({ reportService: () => ({ submit }) }));

import { auth } from '@/auth';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedTooManyRequests = vi.mocked(tooManyRequests);

const SELF_ID = '22222222-2222-2222-2222-222222222222';
const TARGET_ID = '11111111-1111-1111-1111-111111111111';

const req = (body: unknown) =>
  new Request('http://localhost/api/v1/reports', { method: 'POST', body: JSON.stringify(body) });
const valid = { targetType: 'USER', targetId: TARGET_ID, reason: 'спам' };

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/reports', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(401);
    expect(submit).not.toHaveBeenCalled();
  });

  it('400 on invalid body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await POST(req({ targetType: 'X', targetId: 'nope', reason: '' }));
    expect(res.status).toBe(400);
  });

  it('429 when rate limited', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 } as never);
    mockedTooManyRequests.mockReturnValueOnce(NextResponse.json({ error: 't' }, { status: 429 }) as never);
    const res = await POST(req(valid));
    expect(res.status).toBe(429);
    expect(mockedRateLimit).toHaveBeenCalledWith(`report:${SELF_ID}`, 5, 3600);
  });

  it('422 on validation error', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    submit.mockResolvedValue({ ok: false, error: new ValidationError('bad') });
    const res = await POST(req(valid));
    expect(res.status).toBe(422);
  });

  it('409 on duplicate open report', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    submit.mockResolvedValue({ ok: false, error: new ConflictError('dupe') });
    const res = await POST(req(valid));
    expect(res.status).toBe(409);
  });

  it('creates the report', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    submit.mockResolvedValue({ ok: true, value: { id: 'r1' } });
    const res = await POST(req(valid));
    expect(res.status).toBe(200);
    expect(submit).toHaveBeenCalledWith(SELF_ID, 'USER', TARGET_ID, 'спам');
  });
});
