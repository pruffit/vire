import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { alertJobFailure, alertWorkerError, alertCrash } from './alert.js';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  // глушим структурированный лог, чтобы не шуметь в выводе тестов
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.ALERT_WEBHOOK_URL = 'https://hook.test/x';
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ALERT_WEBHOOK_URL;
});

/** Тело последнего POST-а, распарсенное из JSON. */
function lastBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls.at(-1);
  return JSON.parse((call?.[1] as RequestInit).body as string);
}

describe('alert webhook', () => {
  it('без ALERT_WEBHOOK_URL не делает запрос', async () => {
    delete process.env.ALERT_WEBHOOK_URL;
    await alertJobFailure('transcode', 'j-nourl', new Error('boom'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('alertJobFailure POST-ит текст и structured-поля', async () => {
    await alertJobFailure('transcode', 'j1', new Error('boom'), { trackId: 't1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = lastBody();
    expect(body.text).toContain('worker:transcode');
    expect(body.text).toContain('boom');
    expect(body).toMatchObject({ level: 'error', service: 'worker', queue: 'transcode', jobId: 'j1', trackId: 't1' });
  });

  it('одинаковый текст троттлится (не чаще раза в окно)', async () => {
    await alertJobFailure('analyze', 'dup', new Error('same'));
    await alertJobFailure('analyze', 'dup', new Error('same'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('alertWorkerError помечается kind=worker-error', async () => {
    await alertWorkerError('play-events', new Error('redis gone'));
    const body = lastBody();
    expect(body.kind).toBe('worker-error');
    expect(body.text).toContain('redis gone');
  });

  it('alertCrash помечается kind=crash и level=fatal', async () => {
    await alertCrash('uncaughtException', new Error('fatal blow'));
    const body = lastBody();
    expect(body).toMatchObject({ kind: 'crash', level: 'fatal', scope: 'uncaughtException' });
    expect(body.text).toContain('упал процесс');
  });

  it('сбой доставки алерта не бросает', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(alertCrash('unhandledRejection', new Error('x'))).resolves.toBeUndefined();
  });
});
