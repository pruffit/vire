import { describe, it, expect } from 'vitest';
import { parseSentryEnvelope, extractCrashEvent } from './sentry-envelope';

/** Форма, которую реально шлёт @sentry/react-native при необработанном исключении. */
const CRASH_ENVELOPE = [
  JSON.stringify({ event_id: 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d', sent_at: '2026-08-29T12:00:00.000Z' }),
  JSON.stringify({ type: 'event', content_type: 'application/json' }),
  JSON.stringify({
    event_id: 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d',
    timestamp: 1788004800,
    platform: 'javascript',
    level: 'fatal',
    environment: 'production',
    release: 'com.virespace.viremusic@1.0.0+1',
    dist: '1',
    exception: {
      values: [
        {
          type: 'TypeError',
          value: "Cannot read property 'id' of undefined",
          stacktrace: { frames: [{ filename: 'index.android.bundle', lineno: 42 }] },
        },
      ],
    },
    contexts: {
      app: { app_version: '1.0.0' },
      device: { model: '2311DRK48G' },
      os: { name: 'Android', version: '16' },
    },
  }),
].join('\n');

describe('parseSentryEnvelope', () => {
  it('разбирает заголовок и элементы построчно', () => {
    const envelope = parseSentryEnvelope(CRASH_ENVELOPE);

    expect(envelope).not.toBeNull();
    expect(envelope!.header.event_id).toBe('a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d');
    expect(envelope!.items).toHaveLength(1);
    expect(envelope!.items[0].type).toBe('event');
  });

  it('переносит строк \\r\\n не ломают разбор (прокси переписывают тело)', () => {
    const envelope = parseSentryEnvelope(CRASH_ENVELOPE.replace(/\n/g, '\r\n'));
    expect(envelope!.items[0].type).toBe('event');
  });

  it('несколько элементов подряд — читаются все', () => {
    const raw = [
      JSON.stringify({ event_id: 'e1' }),
      JSON.stringify({ type: 'session' }),
      JSON.stringify({ status: 'crashed' }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify({ event_id: 'e1', level: 'fatal' }),
    ].join('\n');

    const envelope = parseSentryEnvelope(raw);

    expect(envelope!.items.map((i) => i.type)).toEqual(['session', 'event']);
  });

  it('мусор вместо заголовка — null, а не исключение', () => {
    expect(parseSentryEnvelope('не json')).toBeNull();
    expect(parseSentryEnvelope('')).toBeNull();
  });

  it('оборванный envelope (заголовок элемента без нагрузки) не роняет разбор', () => {
    const raw = [JSON.stringify({ event_id: 'e1' }), JSON.stringify({ type: 'event' })].join('\n');
    expect(parseSentryEnvelope(raw)!.items).toHaveLength(0);
  });
});

describe('extractCrashEvent', () => {
  it('достаёт поля падения', () => {
    const crash = extractCrashEvent(parseSentryEnvelope(CRASH_ENVELOPE)!);

    expect(crash).toMatchObject({
      eventId: 'a1b2c3d4e5f64a7b8c9d0e1f2a3b4c5d',
      level: 'fatal',
      platform: 'javascript',
      environment: 'production',
      release: 'com.virespace.viremusic@1.0.0+1',
      dist: '1',
      exceptionType: 'TypeError',
      exceptionValue: "Cannot read property 'id' of undefined",
      appVersion: '1.0.0',
      deviceModel: '2311DRK48G',
      osVersion: '16',
    });
  });

  it('timestamp секундами Unix превращается в дату', () => {
    const crash = extractCrashEvent(parseSentryEnvelope(CRASH_ENVELOPE)!);
    expect(crash!.occurredAt?.toISOString()).toBe('2026-08-29T12:00:00.000Z');
  });

  it('timestamp строкой ISO тоже принимается', () => {
    const raw = [
      JSON.stringify({ event_id: 'e1' }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify({ event_id: 'e1', timestamp: '2026-08-29T12:00:00.000Z' }),
    ].join('\n');
    expect(extractCrashEvent(parseSentryEnvelope(raw)!)!.occurredAt?.toISOString()).toBe(
      '2026-08-29T12:00:00.000Z',
    );
  });

  it('payload сохраняется целиком — колонки не заменяют событие', () => {
    const crash = extractCrashEvent(parseSentryEnvelope(CRASH_ENVELOPE)!);
    expect((crash!.payload as { exception: { values: unknown[] } }).exception.values).toHaveLength(1);
  });

  // Envelope без события — не ошибка: SDK шлёт сессии и транзакции тем же каналом.
  it('envelope только с сессией — null', () => {
    const raw = [
      JSON.stringify({ event_id: 'e1' }),
      JSON.stringify({ type: 'session' }),
      JSON.stringify({ status: 'ok' }),
    ].join('\n');
    expect(extractCrashEvent(parseSentryEnvelope(raw)!)).toBeNull();
  });

  it('событие без event_id — null (дедуп невозможен)', () => {
    const raw = [JSON.stringify({ sent_at: 'x' }), JSON.stringify({ type: 'event' }), JSON.stringify({ level: 'fatal' })].join('\n');
    expect(extractCrashEvent(parseSentryEnvelope(raw)!)).toBeNull();
  });

  it('событие без exception (Sentry.captureMessage) разбирается без падения', () => {
    const raw = [
      JSON.stringify({ event_id: 'e1' }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify({ event_id: 'e1', level: 'error', message: 'что-то пошло не так' }),
    ].join('\n');

    const crash = extractCrashEvent(parseSentryEnvelope(raw)!);

    expect(crash!.exceptionType).toBeNull();
    expect(crash!.level).toBe('error');
  });
});
