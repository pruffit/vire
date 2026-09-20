import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isConnectionError,
  armRedisIncidents,
  noteRedisDown,
  noteRedisUp,
  beginRedisShutdown,
  reportWorkerError,
  resetRedisIncident,
} from './redis-incident.js';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  process.env.ALERT_WEBHOOK_URL = 'https://hook.test/x';
  resetRedisIncident();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ALERT_WEBHOOK_URL;
});

function lastBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.at(-1);
  return JSON.parse((call?.[1] as RequestInit).body as string);
}

function bodiesOfKind(kind: string): Record<string, unknown>[] {
  return fetchMock.mock.calls
    .map((call) => JSON.parse((call[1] as RequestInit).body as string) as Record<string, unknown>)
    .filter((body) => body.kind === kind);
}

const FLAP_WINDOW_MS = 60_000;

describe('isConnectionError', () => {
  it('распознаёт по err.code из списка', () => {
    const err = Object.assign(new Error('getaddrinfo EAI_AGAIN redis'), { code: 'EAI_AGAIN' });
    expect(isConnectionError(err)).toBe(true);
  });

  it('распознаёт по узкому тексту ioredis без code', () => {
    expect(isConnectionError(new Error('Connection is closed.'))).toBe(true);
    expect(isConnectionError(new Error("Stream isn't writeable"))).toBe(true);
    expect(isConnectionError(new Error('Command timed out'))).toBe(true);
  });

  it('произвольный текст — не обрыв соединения', () => {
    expect(isConnectionError(new Error('Missing lock for job 42 moveToFinished'))).toBe(false);
  });
});

describe('reportWorkerError: обрыв соединения сводится к одному инциденту', () => {
  it('двенадцать очередей на одну и ту же connection-ошибку → ровно один POST', async () => {
    armRedisIncidents();
    const queues = [
      'transcode', 'analyze', 'analyze-genre', 'play-events', 'notify-release',
      'editorial', 'scheduled-publish', 'fulfill-presave', 'metrics-daily',
      'notify-external', 'jam-reaper', 'storage-cleanup',
    ];
    for (const queue of queues) {
      const err = Object.assign(new Error('getaddrinfo EAI_AGAIN redis'), { code: 'EAI_AGAIN' });
      reportWorkerError(queue, err);
    }
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastBody();
    expect(body.queue).toBe('redis');
  });

  it('не-connection ошибка уходит алертом со своей очередью в тексте', async () => {
    reportWorkerError('transcode', new Error('Missing lock for job 42 moveToFinished'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = lastBody();
    expect(body.queue).toBe('transcode');
    expect(body.text).toContain('Missing lock for job 42 moveToFinished');
  });
});

describe('noteRedisUp', () => {
  it('после простоя и окна флаппинга шлёт один 🟢 с downMs', async () => {
    vi.useFakeTimers();
    armRedisIncidents();
    noteRedisDown(new Error('down'), 1_000);
    noteRedisUp(9_000);
    await vi.advanceTimersByTimeAsync(FLAP_WINDOW_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = lastBody();
    expect(body).toMatchObject({ kind: 'recovered', scope: 'redis', downMs: 8_000 });
  });

  it('без открытого инцидента — тишина', () => {
    armRedisIncidents();
    noteRedisUp();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('флаппинг: серия обрывов внутри окна — один инцидент', () => {
  it('down/up/down/up внутри минуты → одно 🟠 и одно 🟢, длительность от первого обрыва', async () => {
    vi.useFakeTimers();
    armRedisIncidents();
    noteRedisDown(new Error('flap down 1'), 0);
    noteRedisUp(5_000);
    noteRedisDown(new Error('flap down 2'), 20_000);
    noteRedisUp(25_000);
    await vi.advanceTimersByTimeAsync(FLAP_WINDOW_MS);

    expect(bodiesOfKind('worker-error')).toHaveLength(1);
    const recovered = bodiesOfKind('recovered');
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({ downMs: 25_000 });
  });
});

describe('молчание до арминга и после shutdown', () => {
  it('до armRedisIncidents noteRedisDown ничего не шлёт', () => {
    noteRedisDown(new Error('getaddrinfo EAI_AGAIN redis'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('после beginRedisShutdown noteRedisDown ничего не шлёт', () => {
    armRedisIncidents();
    beginRedisShutdown();
    noteRedisDown(new Error('down'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('повторный noteRedisDown внутри открытого инцидента алерт не дублирует', async () => {
    armRedisIncidents();
    noteRedisDown(new Error('down 1'));
    noteRedisDown(new Error('down 2'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });
});
