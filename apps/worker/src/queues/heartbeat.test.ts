import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { pingMock, quitMock, alertStallMock, alertWorkerErrorMock, alertRecoveredMock, redisCtorMock } = vi.hoisted(() => ({
  pingMock: vi.fn(),
  quitMock: vi.fn().mockResolvedValue(undefined),
  alertStallMock: vi.fn().mockResolvedValue(undefined),
  alertWorkerErrorMock: vi.fn().mockResolvedValue(undefined),
  alertRecoveredMock: vi.fn().mockResolvedValue(undefined),
  redisCtorMock: vi.fn(),
}));

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(function RedisMock(url: string, options: unknown) {
    redisCtorMock(url, options);
    return { ping: pingMock, quit: quitMock, on: vi.fn() };
  }),
}));

vi.mock('../lib/alert.js', () => ({
  alertStall: alertStallMock,
  alertWorkerError: alertWorkerErrorMock,
  alertRecovered: alertRecoveredMock,
  alertJobFailure: vi.fn().mockResolvedValue(undefined),
  alertCrash: vi.fn().mockResolvedValue(undefined),
}));

import { startHeartbeat, stopHeartbeat } from './heartbeat.js';
import { armRedisIncidents, beginRedisShutdown, resetRedisIncident } from '../lib/redis-incident.js';

const INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;
const FLAP_WINDOW_MS = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  pingMock.mockReset();
  quitMock.mockClear();
  alertStallMock.mockClear();
  alertWorkerErrorMock.mockClear();
  alertRecoveredMock.mockClear();
  redisCtorMock.mockClear();
  resetRedisIncident();
});

afterEach(async () => {
  await stopHeartbeat();
  vi.useRealTimers();
});

describe('сторож живости: опоздание тика', () => {
  it('тик вовремя — тишина', async () => {
    pingMock.mockResolvedValue('PONG');
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(alertStallMock).not.toHaveBeenCalled();
  });

  it('тик пришёл с опозданием больше порога — alertStall с длительностью', async () => {
    pingMock.mockResolvedValue('PONG');
    startHeartbeat();
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);

    const jumpMs = 20 * 60_000;
    vi.setSystemTime(Date.now() + jumpMs);
    await vi.runOnlyPendingTimersAsync();

    expect(alertStallMock).toHaveBeenCalledTimes(1);
    const [stalledMs] = alertStallMock.mock.calls[0] as [number];
    expect(stalledMs).toBeGreaterThanOrEqual(jumpMs);
  });
});

describe('сторож живости: PING', () => {
  it('PING отвалился несколько тиков подряд → один 🟠; ответил → 🟢', async () => {
    armRedisIncidents();
    pingMock.mockRejectedValue(new Error('Command timed out'));
    startHeartbeat();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(alertWorkerErrorMock).toHaveBeenCalledTimes(1);

    pingMock.mockResolvedValue('PONG');
    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    // 🟢 отложен на окно флаппинга (redis-incident.ts) — ждём его, а не сам факт успешного PING.
    await vi.advanceTimersByTimeAsync(FLAP_WINDOW_MS);
    expect(alertRecoveredMock).toHaveBeenCalledTimes(1);
  });

  it('Redis не поднялся за грейс после старта — алерт всё равно приходит', async () => {
    pingMock.mockRejectedValue(new Error('Connection is closed'));
    startHeartbeat();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(alertWorkerErrorMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4 * INTERVAL_MS);
    expect(alertWorkerErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe('устойчивость тика', () => {
  it('ошибка PING ловится в catch: инцидент открывается, а не бросает исключение наружу', async () => {
    armRedisIncidents();
    pingMock.mockRejectedValue(new Error('Connection is closed'));
    startHeartbeat();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    expect(alertWorkerErrorMock).toHaveBeenCalledTimes(1);
  });
});

describe('сторож живости: конфигурация клиента', () => {
  it('создаётся с выключенной офлайн-очередью и таймаутами пробы', () => {
    pingMock.mockResolvedValue('PONG');
    startHeartbeat();

    expect(redisCtorMock).toHaveBeenCalledTimes(1);
    const [, options] = redisCtorMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(options).toMatchObject({
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: PROBE_TIMEOUT_MS,
      socketTimeout: PROBE_TIMEOUT_MS,
    });
  });
});

describe('шатдаун во время тика', () => {
  it('beginRedisShutdown() до остановки сторожа — тик в полёте алерт не шлёт', async () => {
    armRedisIncidents();
    let rejectPing!: (err: Error) => void;
    pingMock.mockImplementation(() => new Promise((_, reject) => { rejectPing = reject; }));
    startHeartbeat();

    await vi.advanceTimersByTimeAsync(INTERVAL_MS);
    beginRedisShutdown();
    await stopHeartbeat();
    rejectPing(new Error('Connection is closed'));
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);

    expect(alertWorkerErrorMock).not.toHaveBeenCalled();
    expect(alertRecoveredMock).not.toHaveBeenCalled();
  });
});
