import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError } from '@vire/core';

const { resolveCode, setPlayback } = vi.hoisted(() => ({ resolveCode: vi.fn(), setPlayback: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, setPlayback }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { POST } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);
const TRACK_ID = '11111111-1111-1111-1111-111111111111';

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/playback', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/playback', () => {
  it('400 on an unknown transport kind', async () => {
    const res = await POST(req({ kind: 'stop' }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('401 on a forged/unsigned guest session', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await POST(req({ kind: 'pause', positionMs: 1000, sessionId: 'forged' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedResolve.mockResolvedValue({ userId: 'host-1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ kind: 'pause', positionMs: 1000 }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(setPlayback).not.toHaveBeenCalled();
  });

  it('403 when the caller is not a participant of the jam', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'stranger' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    setPlayback.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await POST(req({ kind: 'pause', positionMs: 1000 }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('409 when the jam has ended', async () => {
    mockedResolve.mockResolvedValue({ userId: 'host-1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    setPlayback.mockResolvedValue({ ok: false, error: new ConflictError('Джем уже завершён') });

    const res = await POST(req({ kind: 'track', trackId: TRACK_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });

  it('starts playback as a logged-in participant', async () => {
    mockedResolve.mockResolvedValue({ userId: 'host-1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    const playback = { trackId: TRACK_ID, startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 };
    setPlayback.mockResolvedValue({ ok: true, value: playback });

    const res = await POST(req({ kind: 'play', trackId: TRACK_ID, positionMs: 0 }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(playback);
    expect(setPlayback).toHaveBeenCalledWith('jam-1', { userId: 'host-1' }, { kind: 'play', trackId: TRACK_ID, positionMs: 0 });
  });

  it('starts playback as a guest with a signed sessionId, stripping it before calling the service', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    const playback = { trackId: TRACK_ID, startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 2 };
    setPlayback.mockResolvedValue({ ok: true, value: playback });

    const res = await POST(req({ kind: 'track', trackId: TRACK_ID, sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(setPlayback).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' }, { kind: 'track', trackId: TRACK_ID });
  });
});
