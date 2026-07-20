import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { NotFoundError, ConflictError } from '@vire/core';

const { join } = vi.hoisted(() => ({ join: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ join }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  clientKey: vi.fn().mockReturnValue('jam-join:1.2.3.4'),
  tooManyRequests: vi.fn(),
}));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit, tooManyRequests } from '@/lib/rate-limit';
import { POST } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedTooMany = vi.mocked(tooManyRequests);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/join', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/join', () => {
  it('429 when rate limited', async () => {
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 } as never);
    mockedTooMany.mockReturnValueOnce(NextResponse.json({ error: 'Too many requests' }, { status: 429 }) as never);

    const res = await POST(req({ displayName: 'Guest' }), ctx('A2B3C4'));

    expect(res.status).toBe(429);
    expect(join).not.toHaveBeenCalled();
  });

  it('400 on invalid body (missing displayName)', async () => {
    const res = await POST(req({}), ctx('A2B3C4'));
    expect(res.status).toBe(400);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('401 on a forged/unsigned guest session', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await POST(req({ displayName: 'Guest', sessionId: 'forged' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(join).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    join.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ displayName: 'Guest', sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
  });

  it('409 when the jam has ended', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    join.mockResolvedValue({ ok: false, error: new ConflictError('Джем уже завершён') });

    const res = await POST(req({ displayName: 'Guest', sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });

  it('joins the jam as a guest', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    join.mockResolvedValue({
      ok: true,
      value: { session: { id: 'jam-1', code: 'A2B3C4' }, participant: { id: 'p1', displayName: 'Guest' } },
    });

    const res = await POST(req({ displayName: 'Guest', sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(join).toHaveBeenCalledWith('A2B3C4', { guestSessionId: 'g1' }, 'Guest');
  });
});
