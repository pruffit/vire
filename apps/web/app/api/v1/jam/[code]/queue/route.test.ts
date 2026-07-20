import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError } from '@vire/core';

const { resolveCode, mutateQueue } = vi.hoisted(() => ({ resolveCode: vi.fn(), mutateQueue: vi.fn() }));

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, mutateQueue }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { POST } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);
const TRACK_ID = '11111111-1111-1111-1111-111111111111';
const ITEM_ID = '22222222-2222-2222-2222-222222222222';

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (body: unknown) =>
  new Request('http://localhost/api/v1/jam/A2B3C4/queue', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => vi.clearAllMocks());

describe('POST /api/v1/jam/[code]/queue', () => {
  it('400 on an unknown mutation kind', async () => {
    const res = await POST(req({ kind: 'shuffle' }), ctx('A2B3C4'));
    expect(res.status).toBe(400);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('400 when add is missing trackId', async () => {
    const res = await POST(req({ kind: 'add' }), ctx('A2B3C4'));
    expect(res.status).toBe(400);
  });

  it('401 on a forged/unsigned guest session', async () => {
    mockedResolve.mockResolvedValue(null);

    const res = await POST(req({ kind: 'add', trackId: TRACK_ID, sessionId: 'forged' }), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(mutateQueue).not.toHaveBeenCalled();
  });

  it('404 when the code does not exist', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await POST(req({ kind: 'add', trackId: TRACK_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(mutateQueue).not.toHaveBeenCalled();
  });

  it('403 when a guest tries to remove someone else\'s track', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    mutateQueue.mockResolvedValue({ ok: false, error: new ForbiddenError('Удалить чужой трек может только хост') });

    const res = await POST(req({ kind: 'remove', itemId: ITEM_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('409 when the queue is full', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    mutateQueue.mockResolvedValue({ ok: false, error: new ConflictError('Очередь переполнена') });

    const res = await POST(req({ kind: 'add', trackId: TRACK_ID }), ctx('A2B3C4'));

    expect(res.status).toBe(409);
  });

  it('adds a track, stripping sessionId before calling the service', async () => {
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    mutateQueue.mockResolvedValue({ ok: true, value: { queue: [], version: 4 } });

    const res = await POST(req({ kind: 'add', trackId: TRACK_ID, sessionId: 'g1.sig' }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(mutateQueue).toHaveBeenCalledWith('jam-1', { guestSessionId: 'g1' }, { kind: 'add', trackId: TRACK_ID });
  });

  it('moves a track', async () => {
    mockedResolve.mockResolvedValue({ userId: 'u1' });
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    mutateQueue.mockResolvedValue({ ok: true, value: { queue: [], version: 5 } });

    const res = await POST(req({ kind: 'move', itemId: ITEM_ID, toPosition: 0 }), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(mutateQueue).toHaveBeenCalledWith('jam-1', { userId: 'u1' }, { kind: 'move', itemId: ITEM_ID, toPosition: 0 });
  });
});
