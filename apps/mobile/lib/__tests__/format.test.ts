import { describe, it, expect } from 'vitest';
import { formatDuration, formatBytes } from '../format';

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

describe('formatBytes', () => {
  it('форматирует байты с подходящей единицей', () => {
    expect(formatBytes(0)).toBe('0 Б');
    expect(formatBytes(512)).toBe('512 Б');
    expect(formatBytes(1024)).toBe('1.0 КБ');
    expect(formatBytes(1024 * 1024 * 3.5)).toBe('3.5 МБ');
    expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.0 ГБ');
  });

  it('отрицательные/некорректные значения — 0 Б', () => {
    expect(formatBytes(-5)).toBe('0 Б');
    expect(formatBytes(Number.NaN)).toBe('0 Б');
  });
});
