import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError } from '@vire/core';

const { resolveCode, setPlayback } = vi.hoisted(() => ({ resolveCode: vi.fn(), setPlayback: vi.fn() }));

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, setPlayback }) }));

import { auth } from '@/auth';
import { POST } from './route';

const mockedAuth = vi.mocked(auth);
const TRACK_ID = '11111111-1111-1111-1111-111111111111';

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/playback', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/playback', () => {
  it('401 when there is no session (guests never reach playback)', async () => {
    mockedAuth.mockResolvedValue(null as never);

    const res = await POST(req({ kind: 'pause', positionMs: 1000 }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(resolveCode).not.toHaveBeenCalled();
  });

  it('400 on an unknown transport kind', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1' } } as never);

    const res = await POST(req({ kind: 'stop' }), ctx('A2B3C4'));

    expect(res.status).toBe(400);
  });

  it('404 when the code does not exist', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1' } } as never);
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ kind: 'pause', positionMs: 1000 }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(setPlayback).not.toHaveBeenCalled();
  });

  it('403 when the caller is not the host', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'guest-user' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    setPlayback.mockResolvedValue({ ok: false, error: new ForbiddenError('Только хост управляет воспроизведением') });

    const res = await POST(req({ kind: 'pause', positionMs: 1000 }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('409 when the jam has ended', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    setPlayback.mockResolvedValue({ ok: false, error: new ConflictError('Джем уже завершён') });

    const res = await POST(req({ kind: 'track', trackId: TRACK_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });

  it('starts playback as the host', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'host-1' } } as never);
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    const playback = { trackId: TRACK_ID, startedAtMs: 0, paused: false, pausedPositionMs: 0, version: 1 };
    setPlayback.mockResolvedValue({ ok: true, value: playback });

    const res = await POST(req({ kind: 'play', trackId: TRACK_ID, positionMs: 0 }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(playback);
    expect(setPlayback).toHaveBeenCalledWith('jam-1', 'host-1', { kind: 'play', trackId: TRACK_ID, positionMs: 0 });
  });
});
