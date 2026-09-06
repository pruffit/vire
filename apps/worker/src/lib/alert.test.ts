import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { alertJobFailure, alertWorkerError, alertCrash, alertRecovered } from './alert.js';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  // глушим структурированный лог, чтобы не шуметь в выводе тестов
  vi.spyOn(console, 'error').mockImplementation(() => {});
  process.env.ALERT_WEBHOOK_URL = 'https://hook.test/x';
  // Telegram-канал по умолчанию выключен — отдельный describe его включает.
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_ALERT_CHAT_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ALERT_WEBHOOK_URL;
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_ALERT_CHAT_ID;
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

describe('Telegram-канал', () => {
  beforeEach(() => {
    delete process.env.ALERT_WEBHOOK_URL; // только Telegram
    process.env.TELEGRAM_BOT_TOKEN = 'bot-123';
    process.env.TELEGRAM_ALERT_CHAT_ID = '42';
  });

  it('шлёт в Telegram Bot API с chat_id и текстом', async () => {
    await alertCrash('uncaughtException', new Error('tg boom'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/botbot-123/sendMessage');
    const body = JSON.parse(init.body as string);
    expect(body.chat_id).toBe('42');
    expect(body.text).toContain('tg boom');
  });

  it('без TELEGRAM_ALERT_CHAT_ID в Telegram не шлёт', async () => {
    delete process.env.TELEGRAM_ALERT_CHAT_ID;
    await alertCrash('uncaughtException', new Error('no chat'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('оба канала: и Telegram, и webhook', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://hook.test/x';
    await alertWorkerError('transcode', new Error('both'));
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain('https://api.telegram.org/botbot-123/sendMessage');
    expect(urls).toContain('https://hook.test/x');
  });
});

describe('alertRecovered', () => {
  it('закрывает инцидент: kind=recovered и длительность простоя', async () => {
    await alertRecovered('redis', 7_200_000);
    const body = lastBody();
    expect(body).toMatchObject({ kind: 'recovered', level: 'warn', scope: 'redis', downMs: 7_200_000 });
    expect(body.text).toContain('7200с');
  });
});
