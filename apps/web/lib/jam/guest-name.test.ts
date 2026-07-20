import { describe, it, expect } from 'vitest';
import { generateGuestName } from './guest-name';

describe('generateGuestName', () => {
  it('строит имя из инъектированного random детерминированно', () => {
    expect(generateGuestName(() => 0)).toBe(generateGuestName(() => 0));
  });

  it('всегда непустая строка из двух слов', () => {
    const name = generateGuestName(() => 0.5);
    expect(name.split(' ')).toHaveLength(2);
  });
});
