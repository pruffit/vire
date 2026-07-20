import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError } from '@vire/core';

const { resolveCode, heartbeat } = vi.hoisted(() => ({ resolveCode: vi.fn(), heartbeat: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, heartbeat }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { POST } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/heartbeat', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/heartbeat', () => {
  it('401 on a forged/unsigned guest session', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await POST(req({ sessionId: 'forged' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(heartbeat).not.toHaveBeenCalled();
  });

  it('403 when the caller is not a participant', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    heartbeat.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req({ sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('records a heartbeat for a participant', async () => {
    mockedResolve.mockResolvedValue({ userId: 'u1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    heartbeat.mockResolvedValue({ ok: true, value: undefined });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(heartbeat).toHaveBeenCalledWith('jam-1', { userId: 'u1' });
  });
});
