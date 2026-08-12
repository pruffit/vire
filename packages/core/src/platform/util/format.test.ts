import { describe, it, expect } from 'vitest';
import { formatDuration, formatListenTime, formatCount, releaseYear, totalDuration } from './format';

const unit = { seconds: 'с', minutes: 'м', hours: 'ч' };

describe('formatDuration', () => {
  it('formats sub-minute durations with zero-padded seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(59)).toBe('0:59');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(75)).toBe('1:15');
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('floors fractional seconds', () => {
    expect(formatDuration(75.9)).toBe('1:15');
  });
});

describe('formatListenTime', () => {
  it('uses seconds below a minute', () => {
    expect(formatListenTime(0, unit)).toBe('0с');
    expect(formatListenTime(45, unit)).toBe('45с');
  });

  it('uses whole minutes below an hour', () => {
    expect(formatListenTime(60, unit)).toBe('1м');
    expect(formatListenTime(600, unit)).toBe('10м');
    expect(formatListenTime(3599, unit)).toBe('59м');
  });

  it('uses hours and minutes from an hour up', () => {
    expect(formatListenTime(3600, unit)).toBe('1ч 0м');
    expect(formatListenTime(3700, unit)).toBe('1ч 1м');
    expect(formatListenTime(7325, unit)).toBe('2ч 2м');
  });

  it('supports other locale units', () => {
    expect(formatListenTime(45, { seconds: 's', minutes: 'm', hours: 'h' })).toBe('45s');
    expect(formatListenTime(3700, { seconds: 's', minutes: 'm', hours: 'h' })).toBe('1h 1m');
  });
});

describe('formatCount', () => {
  it('returns the raw number below 1000', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(999)).toBe('999');
  });

  it('compacts thousands with one decimal', () => {
    expect(formatCount(1000)).toBe('1.0k');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(12345)).toBe('12.3k');
  });
});

describe('releaseYear', () => {
  it('returns null for absent dates', () => {
    expect(releaseYear(null)).toBeNull();
    expect(releaseYear(undefined)).toBeNull();
  });

  it('extracts the year from a Date or ISO string', () => {
    expect(releaseYear(new Date('2026-06-07T00:00:00Z'))).toBe(2026);
    expect(releaseYear('2024-01-15')).toBe(2024);
  });

  it('returns null for an unparseable string', () => {
    expect(releaseYear('not a date')).toBeNull();
  });
});

describe('totalDuration', () => {
  it('sums only READY tracks with a duration', () => {
    expect(
      totalDuration([
        { status: 'READY', durationSec: 65 },
        { status: 'READY', durationSec: 130 },
        { status: 'PROCESSING', durationSec: 999 }, // ignored
        { status: 'READY', durationSec: null }, // ignored
      ]),
    ).toBe('3:15');
  });

  it('returns null when nothing qualifies', () => {
    expect(totalDuration([])).toBeNull();
    expect(totalDuration([{ status: 'PROCESSING', durationSec: 100 }])).toBeNull();
    expect(totalDuration([{ status: 'READY', durationSec: 0 }])).toBeNull();
  });
});
