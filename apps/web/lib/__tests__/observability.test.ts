import { describe, it, expect } from 'vitest';
import { isKnownNoise } from '../observability';

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
