import { describe, it, expect, vi, beforeEach } from 'vitest';

const { insertMobileCrash, rateLimit } = vi.hoisted(() => ({
  insertMobileCrash: vi.fn().mockResolvedValue(undefined),
  rateLimit: vi.fn().mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 }),
}));

vi.mock('@vire/db', () => ({ insertMobileCrash }));
vi.mock('@/lib/rate-limit', () => ({
  rateLimit,
  clientKey: vi.fn(() => 'crash:test'),
  tooManyRequests: vi.fn(() => new Response(null, { status: 429 })),
}));

import { POST } from './route';

function envelope(event: Record<string, unknown>, headerEventId = 'e1'): string {
  return [
    JSON.stringify({ event_id: headerEventId, sent_at: '2026-08-29T12:00:00.000Z' }),
    JSON.stringify({ type: 'event', content_type: 'application/json' }),
    JSON.stringify(event),
  ].join('\n');
}

function makeReq(body: string): Request {
  return new Request('http://localhost/api/1/envelope/?sentry_key=k&sentry_version=7', {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-sentry-envelope' },
  });
}

const CRASH = {
  event_id: 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d',
  timestamp: 1788004800,
  level: 'fatal',
  platform: 'javascript',
  release: 'com.virespace.viremusic@1.0.0+1',
  exception: { values: [{ type: 'TypeError', value: 'boom' }] },
  contexts: { device: { model: '2311DRK48G' }, os: { version: '16' } },
};

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue({ ok: true, remaining: 1, retryAfter: 0 });
});

describe('POST /api/1/envelope', () => {
  it('записывает падение и возвращает его id', async () => {
    const res = await POST(makeReq(envelope(CRASH)));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ id: 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d' });
    expect(insertMobileCrash).toHaveBeenCalledTimes(1);
    expect(insertMobileCrash.mock.calls[0][0]).toMatchObject({
      eventId: 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d',
      exceptionType: 'TypeError',
      exceptionValue: 'boom',
      deviceModel: '2311DRK48G',
      osVersion: '16',
    });
  });

  // Сессии и транзакции идут тем же каналом. 200 обязателен: на ошибку SDK положит
  // событие в очередь и будет слать снова — бесконечно, ведь мы его хранить не собираемся.
  it('envelope без события — 200 и ничего не пишет', async () => {
    const raw = [
      JSON.stringify({ event_id: 'e1' }),
      JSON.stringify({ type: 'session' }),
      JSON.stringify({ status: 'ok' }),
    ].join('\n');

    const res = await POST(makeReq(raw));

    expect(res.status).toBe(200);
    expect(insertMobileCrash).not.toHaveBeenCalled();
  });

  it('мусор вместо envelope — 400', async () => {
    const res = await POST(makeReq('не envelope'));

    expect(res.status).toBe(400);
    expect(insertMobileCrash).not.toHaveBeenCalled();
  });

  it('пустое тело — 400', async () => {
    const res = await POST(makeReq(''));
    expect(res.status).toBe(400);
  });

  it('превышен лимит частоты — 429, запись не трогаем', async () => {
    rateLimit.mockResolvedValue({ ok: false, remaining: 0, retryAfter: 30 });

    const res = await POST(makeReq(envelope(CRASH)));

    expect(res.status).toBe(429);
    expect(insertMobileCrash).not.toHaveBeenCalled();
  });

  it('слишком большое тело по content-length — 413 без чтения', async () => {
    const req = new Request('http://localhost/api/1/envelope/', {
      method: 'POST',
      body: 'x',
      headers: { 'content-length': String(2 * 1024 * 1024) },
    });

    const res = await POST(req);

    expect(res.status).toBe(413);
    expect(insertMobileCrash).not.toHaveBeenCalled();
  });

  it('отказ БД — 500, чтобы SDK повторил отправку', async () => {
    insertMobileCrash.mockRejectedValueOnce(new Error('db down'));

    const res = await POST(makeReq(envelope(CRASH)));

    expect(res.status).toBe(500);
  });

  it('аутентификации не требует — краш случается и до входа', async () => {
    const res = await POST(makeReq(envelope(CRASH)));
    expect(res.status).toBe(200);
  });
});
