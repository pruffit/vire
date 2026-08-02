import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError, ValidationError } from '@vire/core';

const { resolveCode, voteSkip } = vi.hoisted(() => ({ resolveCode: vi.fn(), voteSkip: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, voteSkip }) }));
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
const ITEM_ID = '11111111-1111-1111-1111-111111111111';

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/skip', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/skip', () => {
  it('400 on an invalid itemId', async () => {
    const res = await POST(req({ itemId: 'not-a-uuid' }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('401 on a forged/unsigned guest session', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await POST(req({ itemId: ITEM_ID, sessionId: 'forged' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('429 when rate limited', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    mockedRateLimit.mockResolvedValueOnce({ ok: false, remaining: 0, retryAfter: 30 });

    const res = await POST(req({ itemId: ITEM_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(429);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ itemId: ITEM_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(voteSkip).not.toHaveBeenCalled();
  });

  it('403 when the caller is not a participant', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'ghost' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    voteSkip.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req({ itemId: ITEM_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('400 in a regular JAM session', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    voteSkip.mockResolvedValue({ ok: false, error: new ValidationError('Голосование за пропуск доступно только в режиме вечеринки') });

    const res = await POST(req({ itemId: ITEM_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
  });

  it('409 when the jam has ended', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    voteSkip.mockResolvedValue({ ok: false, error: new ConflictError('Джем уже завершён') });

    const res = await POST(req({ itemId: ITEM_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });

  it('records the vote and returns the tally', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    voteSkip.mockResolvedValue({ ok: true, value: { itemId: ITEM_ID, votes: 1, needed: 2 } });

    const res = await POST(req({ itemId: ITEM_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ itemId: ITEM_ID, votes: 1, needed: 2 });
    expect(voteSkip).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' }, ITEM_ID);
  });
});
