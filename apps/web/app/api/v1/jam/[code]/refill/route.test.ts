import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '@vire/core';

const { resolveCode, refillFromWave } = vi.hoisted(() => ({ resolveCode: vi.fn(), refillFromWave: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, refillFromWave }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { rateLimit } from '@/lib/rate-limit';
import { POST } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);
const mockedRateLimit = vi.mocked(rateLimit);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/refill', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/refill', () => {
  it('400 on an invalid body (sessionId too long)', async () => {
    const res = await POST(req({ sessionId: 'x'.repeat(500) }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('401 on a forged/unsigned guest session', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await POST(req({ sessionId: 'forged' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist — never reaches the rate limiter', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(mockedRateLimit).not.toHaveBeenCalled();
    expect(refillFromWave).not.toHaveBeenCalled();
  });

  it('429 when the per-jam refill rate limit is exceeded', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(429);
    expect(refillFromWave).not.toHaveBeenCalled();
  });

  it('403 when the caller is not a participant', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'ghost' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    refillFromWave.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('400 in a regular JAM session', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    refillFromWave.mockResolvedValue({ ok: false, error: new ValidationError('Автодобор доступен только в режиме вечеринки') });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(400);
  });

  it('409 when the jam has ended', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    refillFromWave.mockResolvedValue({ ok: false, error: new ConflictError('Джем уже завершён') });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });

  it('refills and returns the fresh queue', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    refillFromWave.mockResolvedValue({ ok: true, value: { queue: [], version: 4 } });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ queue: [], version: 4 });
    expect(refillFromWave).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' });
  });
});
