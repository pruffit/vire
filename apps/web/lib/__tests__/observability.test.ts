import { describe, it, expect } from 'vitest';
import { isKnownNoise, describeError, formatAlertText } from '../observability';

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

  it('обходится тем, что есть', () => {
    expect(formatAlertText('web', { where: 'GET /x', routePath: '/x' }, 'boom'))
      .toBe('🔴 [web] GET /x: boom [/x]');
    expect(formatAlertText('worker', {}, 'boom')).toBe('🔴 [worker] error: boom');
  });
});
