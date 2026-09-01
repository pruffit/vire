import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('../api-client', () => ({ apiRequest }));

const store = vi.hoisted(() => new Map<string, string>());
vi.mock('../storage/file-store', () => ({
  fileStore: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
}));

import { reportListen, flushPending, readPending, writePending, __resetSessionForTests } from '../playback/play-reporter';
import type { ListenSpan } from '../playback/listen-tracker';

const span = (trackId: string, sec = 30): ListenSpan => ({
  trackId,
  source: 'release',
  startedAt: '2026-08-29T12:00:00.000Z',
  durationPlayedSec: sec,
});

function mockRoutes({ session = true, play = true }: { session?: boolean; play?: boolean } = {}) {
  apiRequest.mockImplementation((path: string) => {
    if (path === '/api/v1/session') {
      return Promise.resolve(
        session ? { ok: true, data: { sessionId: 'signed-sid' } } : { ok: false, error: { status: 0, message: 'нет сети' } },
      );
    }
    return Promise.resolve(
      play ? { ok: true, data: { ok: true } } : { ok: false, error: { status: 0, message: 'нет сети' } },
    );
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
  __resetSessionForTests();
});

describe('отправка прослушиваний', () => {
  it('отправляет событие с подписанным sessionId', async () => {
    mockRoutes();

    await reportListen(span('track-1'));

    const call = apiRequest.mock.calls.find(([p]) => String(p).includes('/play'));
    expect(call![0]).toBe('/api/v1/tracks/track-1/play');
    expect(call![1].body).toEqual({
      sessionId: 'signed-sid',
      source: 'release',
      durationPlayedSec: 30,
      startedAt: '2026-08-29T12:00:00.000Z',
    });
    expect(readPending()).toEqual([]);
  });

  // sessionId выдаёт только сервер — подпись произвольного клиентского id обесценила бы HMAC.
  it('sessionId берётся у сервера один раз и переиспользуется', async () => {
    mockRoutes();

    await reportListen(span('a'));
    await reportListen(span('b'));

    expect(apiRequest.mock.calls.filter(([p]) => p === '/api/v1/session')).toHaveLength(1);
  });

  it('без сети событие остаётся в очереди и уходит позже', async () => {
    mockRoutes({ play: false });
    await reportListen(span('offline-track'));

    expect(readPending()).toHaveLength(1);

    mockRoutes();
    await flushPending();

    expect(readPending()).toEqual([]);
    expect(apiRequest.mock.calls.some(([p]) => String(p).includes('offline-track/play'))).toBe(true);
  });

  it('нет сессии — ничего не теряем, событие ждёт', async () => {
    mockRoutes({ session: false });

    await reportListen(span('t'));

    expect(readPending()).toHaveLength(1);
  });

  it('копит несколько офлайн-событий и рассылает пачкой', async () => {
    mockRoutes({ play: false });
    await reportListen(span('a'));
    await reportListen(span('b'));
    await reportListen(span('c'));
    expect(readPending()).toHaveLength(3);

    mockRoutes();
    await flushPending();

    expect(readPending()).toEqual([]);
  });

  // 4xx означает, что событие не примут и при повторе — держать его вечно бессмысленно.
  it('отказ 400 выбрасывает событие, а не копит его', async () => {
    apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/v1/session'
          ? { ok: true, data: { sessionId: 'sid' } }
          : { ok: false, error: { status: 400, message: 'Bad request' } },
      ),
    );

    await reportListen(span('bad'));

    expect(readPending()).toEqual([]);
  });

  it('5xx оставляет событие в очереди — сервер мог просто прилечь', async () => {
    apiRequest.mockImplementation((path: string) =>
      Promise.resolve(
        path === '/api/v1/session'
          ? { ok: true, data: { sessionId: 'sid' } }
          : { ok: false, error: { status: 503, message: 'unavailable' } },
      ),
    );

    await reportListen(span('t'));

    expect(readPending()).toHaveLength(1);
  });

  it('очередь ограничена — файл не растёт бесконечно', async () => {
    mockRoutes({ play: false });
    for (let i = 0; i < 260; i++) await reportListen(span(`t${i}`));

    const pending = readPending();
    expect(pending.length).toBeLessThanOrEqual(200);
    // Режем с головы: свежие прослушивания ценнее давних.
    expect(pending[pending.length - 1].trackId).toBe('t259');
  });

  // Живой прогон дал четыре одинаковые строки в play_events: рассылку дёргают уход в фон,
  // возврат и восстановление стора, и параллельные проходы читали одну очередь.
  it('параллельные рассылки не отправляют событие дважды', async () => {
    let plays = 0;
    apiRequest.mockImplementation((path: string) => {
      if (path === '/api/v1/session') return Promise.resolve({ ok: true, data: { sessionId: 'sid' } });
      plays += 1;
      return new Promise((resolve) => setTimeout(() => resolve({ ok: true, data: { ok: true } }), 20));
    });

    await Promise.all([reportListen(span('t')), flushPending(), flushPending(), flushPending()]);

    expect(plays).toBe(1);
    expect(readPending()).toEqual([]);
  });

  it('событие, добавленное во время рассылки, не теряется', async () => {
    apiRequest.mockImplementation((path: string) => {
      if (path === '/api/v1/session') return Promise.resolve({ ok: true, data: { sessionId: 'sid' } });
      // Пока идёт отправка первого, приходит второе.
      writePending([...readPending(), span('late')]);
      return Promise.resolve({ ok: false, error: { status: 503, message: 'unavailable' } });
    });

    await reportListen(span('first'));

    const ids = readPending().map((s) => s.trackId);
    expect(ids).toContain('first');
    expect(ids).toContain('late');
  });

  it('пустой вызов без накопленного ничего не шлёт', async () => {
    mockRoutes();

    await reportListen(null);

    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('исключение в сети не пробрасывается наружу — воспроизведение важнее отчёта', async () => {
    apiRequest.mockImplementation((path: string) =>
      path === '/api/v1/session'
        ? Promise.resolve({ ok: true, data: { sessionId: 'sid' } })
        : Promise.reject(new Error('boom')),
    );

    await expect(reportListen(span('t'))).resolves.toBeUndefined();
    expect(readPending()).toHaveLength(1);
  });
});
