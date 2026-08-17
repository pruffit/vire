import { describe, it, expect } from 'vitest';
import { formatDuration } from '../format';

describe('formatDuration', () => {
  it('форматирует секунды в m:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('округляет вниз дробные секунды', () => {
    expect(formatDuration(65.9)).toBe('1:05');
  });

  it('null/некорректные значения — плейсхолдер', () => {
    expect(formatDuration(null)).toBe('—:—');
    expect(formatDuration(-1)).toBe('—:—');
    expect(formatDuration(Number.NaN)).toBe('—:—');
  });
});
