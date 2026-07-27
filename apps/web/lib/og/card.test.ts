import { describe, it, expect } from 'vitest';
import { clampOgText } from './card';

describe('clampOgText', () => {
  it('короткая строка проходит как есть', () => {
    expect(clampOgText('Название релиза', 60)).toBe('Название релиза');
  });

  it('длинная строка режется с многоточием и укладывается в лимит', () => {
    const out = clampOgText('а'.repeat(200), 60);
    expect(out).toHaveLength(60);
    expect(out.endsWith('…')).toBe(true);
  });

  it('переносы и повторные пробелы схлопываются в один', () => {
    expect(clampOgText('  Био\n\nартиста   тут  ', 60)).toBe('Био артиста тут');
  });

  it('хвостовой пробел перед многоточием убирается', () => {
    expect(clampOgText('раз два три четыре', 9)).toBe('раз два…');
  });
});
