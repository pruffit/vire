import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isKnownNoise, describeError, formatAlertText, stackHead, captureError } from '../observability';

describe('isKnownNoise', () => {
  it('глушит kState transformAlgorithm (баг Node webstreams при обрыве стрима)', () => {
    expect(isKnownNoise('controller[kState].transformAlgorithm is not a function')).toBe(true);
  });

  it('глушит Failed to find Server Action (старые вкладки после деплоя)', () => {
    expect(
      isKnownNoise(
        'Failed to find Server Action "x123". This request might be from an older or newer deployment.',
      ),
    ).toBe(true);
  });

  it('не глушит обычные ошибки', () => {
    expect(isKnownNoise('ECONNREFUSED 127.0.0.1:5432')).toBe(false);
    expect(isKnownNoise('relation "tracks" does not exist')).toBe(false);
    expect(isKnownNoise('')).toBe(false);
  });
});

describe('describeError', () => {
  it('отдаёт message, когда он есть', () => {
    expect(describeError(new Error('relation "tracks" does not exist'))).toBe(
      'relation "tracks" does not exist',
    );
  });

  it('на пустом message падает на имя ошибки — иначе алерт вида «POST /ru:»', () => {
    expect(describeError(new Error(''))).toBe('Error без message');
    expect(describeError(new TypeError())).toBe('TypeError без message');
  });

  it('добавляет digest, когда он есть (ошибки Next)', () => {
    const err = Object.assign(new Error(''), { digest: 'NEXT_REDIRECT' });
    expect(describeError(err)).toBe('Error без message (digest=NEXT_REDIRECT)');
  });

  it('описывает брошенное не-Error', () => {
    expect(describeError('boom')).toBe('boom');
    expect(describeError({})).toBe('без message: [object Object]');
    expect(describeError('   ')).toBe('без message: [object String]');
    expect(describeError(null)).toBe('null');
  });
});

describe('formatAlertText', () => {
  it('дописывает routeType и routePath — без них digest не локализуется', () => {
    const text = formatAlertText('web', {
      where: 'POST /ru', routeType: 'action', routePath: '/[locale]',
    }, 'Error без message (digest=3916268529)');

    expect(text).toBe('🔴 [web] POST /ru: Error без message (digest=3916268529) [action /[locale]]');
  });

  it('дописывает renderSource — он делит RSC-рендер и SSR клиентских компонентов', () => {
    const text = formatAlertText('web', {
      where: 'POST /ru', routeType: 'action', routePath: '/[locale]',
      renderSource: 'server-rendering',
    }, 'Error без message');

    expect(text).toBe('🔴 [web] POST /ru: Error без message [action /[locale] server-rendering]');
  });

  it('обходится тем, что есть', () => {
    expect(formatAlertText('web', { where: 'GET /x', routePath: '/x' }, 'boom'))
      .toBe('🔴 [web] GET /x: boom [/x]');
    expect(formatAlertText('worker', {}, 'boom')).toBe('🔴 [worker] error: boom');
  });
});

describe('stackHead', () => {
  const stack = [
    'Error',
    '    at eO (/app/apps/web/.next/server/chunks/8234.js:1:12345)',
    '    at nJ (/app/apps/web/.next/server/chunks/8234.js:1:67890)',
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)',
  ].join('\n');

  it('срезает заголовок и отдаёт кадры', () => {
    expect(stackHead(stack, 2)).toBe(
      '↳ at eO (/app/apps/web/.next/server/chunks/8234.js:1:12345)\n' +
      '↳ at nJ (/app/apps/web/.next/server/chunks/8234.js:1:67890)',
    );
  });

  it('ограничивает число кадров — в Telegram лимит 4000 символов', () => {
    expect(stackHead(stack).split('\n')).toHaveLength(3);
  });

  it('без стека отдаёт пустую строку', () => {
    expect(stackHead(undefined)).toBe('');
    expect(stackHead('Error')).toBe('');
  });
});

describe('captureError', () => {
  const sent: string[] = [];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    sent.length = 0;
    for (const key of ['ALERT_WEBHOOK_URL', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_ALERT_CHAT_ID']) {
      saved[key] = process.env[key];
    }
    // Telegram-канал глушим: на проде он всё равно идёт через релей, а тут дал бы второй fetch.
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ALERT_CHAT_ID;
    process.env.ALERT_WEBHOOK_URL = 'https://relay.test/secret';
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(String(JSON.parse(init.body).text));
      return new Response('{}');
    }));
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('при пустом message дописывает голову стека — иначе место не найти', async () => {
    const err = Object.assign(new Error(''), { digest: '3916268529' });
    err.stack = 'Error\n    at eO (/app/apps/web/.next/server/chunks/8234.js:1:12345)';

    await captureError(err, { where: 'POST /ru', routeType: 'action', routePath: '/[locale]' });

    expect(sent[0]).toBe(
      '🔴 [web] POST /ru: Error без message (digest=3916268529) [action /[locale]]\n' +
      '↳ at eO (/app/apps/web/.next/server/chunks/8234.js:1:12345)',
    );
  });

  it('ошибку с текстом стеком не раздувает', async () => {
    const err = new Error('relation "tracks" does not exist');
    err.stack = 'Error: relation "tracks" does not exist\n    at q (/app/x.js:1:2)';

    await captureError(err, { where: 'GET /releases' });

    expect(sent[0]).toBe('🔴 [web] GET /releases: relation "tracks" does not exist');
  });

  it('ошибку без стека не ломает', async () => {
    const err = new Error('');
    err.stack = undefined;

    await captureError(err, { where: 'GET /nostack' });

    expect(sent[0]).toBe('🔴 [web] GET /nostack: Error без message');
  });

  it('не-Error значению стека взять неоткуда', async () => {
    await captureError({ code: 42 }, { where: 'GET /thrown-object' });

    expect(sent[0]).toBe('🔴 [web] GET /thrown-object: без message: [object Object]');
    const logged = JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string);
    expect(logged).not.toHaveProperty('stack');
  });

  it('пишет стек в structured-лог и режет его — раньше он терялся целиком', async () => {
    const spy = vi.spyOn(console, 'error');
    const err = new Error('boom');
    err.stack = `Error: boom\n${'    at z (/app/y.js:3:4)\n'.repeat(200)}`;

    await captureError(err, { where: 'GET /health' });

    const logged = JSON.parse(spy.mock.calls[0][0] as string).stack as string;
    expect(logged).toHaveLength(2000);
    expect(logged.startsWith('Error: boom')).toBe(true);
  });

  it('одинаковую ошибку с разными кадрами глушит анти-шторм — ключ без стека', async () => {
    const first = Object.assign(new Error(''), { digest: '777' });
    first.stack = 'Error\n    at aA (/app/chunk.js:1:1)';
    const second = Object.assign(new Error(''), { digest: '777' });
    second.stack = 'Error\n    at bB (/app/chunk.js:1:999)';
    const ctx = { where: 'POST /ru', routeType: 'action', routePath: '/[locale]' };

    await captureError(first, ctx);
    await captureError(second, ctx);

    expect(sent).toHaveLength(1);
  });
});
