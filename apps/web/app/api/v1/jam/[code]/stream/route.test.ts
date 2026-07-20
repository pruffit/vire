import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError } from '@vire/core';

const { resolveCode, getState, heartbeat, subscribeChannel, unsubscribe } = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  return {
    resolveCode: vi.fn(),
    getState: vi.fn(),
    heartbeat: vi.fn(),
    subscribeChannel: vi.fn(() => unsubscribe),
    unsubscribe,
  };
});

vi.mock('@/lib/jam', () => ({ jamService: () => ({ resolveCode, getState, heartbeat }) }));
vi.mock('@/lib/jam/jam-identity', () => ({ resolveJamIdentity: vi.fn() }));
vi.mock('@/lib/realtime', () => ({ subscribeChannel, jamChannel: (id: string) => `rt:jam:${id}` }));

import { resolveJamIdentity } from '@/lib/jam/jam-identity';
import { GET } from './route';

const mockedResolve = vi.mocked(resolveJamIdentity);

const ctx = (code: string) => ({ params: Promise.resolve({ code }) });
const req = (code: string, sessionId?: string) =>
  new Request(`http://localhost/api/v1/jam/${code}/stream${sessionId ? `?sessionId=${sessionId}` : ''}`);

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/jam/[code]/stream', () => {
  it('404 when the code does not exist', async () => {
    resolveCode.mockResolvedValue({ ok: false, error: new NotFoundError('Jam', 'A2B3C4') });

    const res = await GET(req('A2B3C4'), ctx('A2B3C4'));

    expect(res.status).toBe(404);
    expect(resolveJamIdentity).not.toHaveBeenCalled();
  });

  it('401 when identity cannot be resolved (no session, no auth)', async () => {
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    mockedResolve.mockResolvedValue(null);

    const res = await GET(req('A2B3C4'), ctx('A2B3C4'));

    expect(res.status).toBe(401);
    expect(getState).not.toHaveBeenCalled();
  });

  it('403 when the caller is not a participant', async () => {
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    mockedResolve.mockResolvedValue({ guestSessionId: 'g1' });
    getState.mockResolvedValue({ ok: false, error: new ForbiddenError('Вы не участник этого джема') });

    const res = await GET(req('A2B3C4', 'g1.sig'), ctx('A2B3C4'));

    expect(res.status).toBe(403);
  });

  it('opens an SSE stream for a participant and sends a snapshot', async () => {
    resolveCode.mockResolvedValue({ ok: true, value: { id: 'jam-1' } });
    mockedResolve.mockResolvedValue({ userId: 'u1' });
    getState.mockResolvedValue({
      ok: true,
      value: { session: { id: 'jam-1', queueVersion: 3 }, participants: [], queue: [], playback: null },
    });

    const res = await GET(req('A2B3C4'), ctx('A2B3C4'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(subscribeChannel).toHaveBeenCalledWith('rt:jam:jam-1', expect.any(Function));
    expect(heartbeat).toHaveBeenCalledWith('jam-1', { userId: 'u1' });

    await res.body?.cancel();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
