import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError } from '@vire/core';

const { resolveCode, setMode } = vi.hoisted(() => ({ resolveCode: vi.fn(), setMode: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, setMode }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { POST } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/mode', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/mode', () => {
  it('400 on an unknown mode', async () => {
    const res = await POST(req({ mode: 'STAGE' }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('401 on a forged/unsigned guest session', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await POST(req({ mode: 'SPEAKER', sessionId: 'forged' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedResolve.mockResolvedValue({ userId: 'host-1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ mode: 'SPEAKER' }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(setMode).not.toHaveBeenCalled();
  });

  it('403 when the caller is not the host', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'guest-1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    setMode.mockResolvedValue({ ok: false, error: new ForbiddenError('Режим меняет только хост') });

    const res = await POST(req({ mode: 'SPEAKER' }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('409 when the jam has ended', async () => {
    mockedResolve.mockResolvedValue({ userId: 'host-1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    setMode.mockResolvedValue({ ok: false, error: new ConflictError('Джем уже завершён') });

    const res = await POST(req({ mode: 'SPEAKER' }), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });

  it('switches the mode as the host and broadcasts jam:session (via the service)', async () => {
    mockedResolve.mockResolvedValue({ userId: 'host-1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    setMode.mockResolvedValue({ ok: true, value: { mode: 'SPEAKER', speakerParticipantId: null } });

    const res = await POST(req({ mode: 'SPEAKER' }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ mode: 'SPEAKER', speakerParticipantId: null });
    expect(setMode).toHaveBeenCalledWith('jam-1', { userId: 'host-1' }, 'SPEAKER');
  });

  it('resolves a guest with a signed sessionId', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    setMode.mockResolvedValue({ ok: true, value: { mode: 'SYNCED', speakerParticipantId: null } });

    const res = await POST(req({ mode: 'SYNCED', sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(setMode).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' }, 'SYNCED');
  });
});
