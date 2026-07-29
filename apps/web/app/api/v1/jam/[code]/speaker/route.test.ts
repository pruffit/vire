import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError } from '@vire/core';

const { resolveCode, claimSpeaker } = vi.hoisted(() => ({ resolveCode: vi.fn(), claimSpeaker: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, claimSpeaker }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { POST } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/speaker', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/speaker', () => {
  it('401 on a forged/unsigned guest session', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await POST(req({ sessionId: 'forged' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedResolve.mockResolvedValue({ userId: 'host-1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(claimSpeaker).not.toHaveBeenCalled();
  });

  it('403 when the caller is not a participant of the jam', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'stranger' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    claimSpeaker.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('409 when the jam has ended', async () => {
    mockedResolve.mockResolvedValue({ userId: 'host-1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    claimSpeaker.mockResolvedValue({ ok: false, error: new ConflictError('Джем уже завершён') });

    const res = await POST(req({}), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });

  it('lets any participant claim the speaker role', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    claimSpeaker.mockResolvedValue({ ok: true, value: { mode: 'SPEAKER', speakerParticipantId: 'p-guest' } });

    const res = await POST(req({ sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ mode: 'SPEAKER', speakerParticipantId: 'p-guest' });
    expect(claimSpeaker).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' });
  });
});
