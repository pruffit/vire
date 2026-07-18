import { describe, it, expect, vi, beforeEach } from 'vitest';

const { subscribe, unsubscribe } = vi.hoisted(() => {
  const unsubscribe = vi.fn();
  return { subscribe: vi.fn(() => unsubscribe), unsubscribe };
});

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/realtime', () => ({ subscribe }));

import { auth } from '@/auth';
import { GET } from './route';

const mockedAuth = vi.mocked(auth);
const SELF_ID = '22222222-2222-2222-2222-222222222222';

const req = () => new Request('http://localhost/api/v1/realtime/stream');

beforeEach(() => vi.clearAllMocks());

describe('GET /api/v1/realtime/stream', () => {
  it('401 when not authenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const res = await GET(req());
    expect(res.status).toBe(401);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('opens an SSE stream for an authenticated user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: SELF_ID } } as never);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
    expect(subscribe).toHaveBeenCalledWith(SELF_ID, expect.any(Function));
    // отменяем стрим → cleanup() снимает подписку и heartbeat-интервал (иначе тест висит)
    await res.body?.cancel();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
