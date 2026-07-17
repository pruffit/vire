import { describe, it, expect } from 'vitest';
import { yesterdayMsk } from './msk-date.js';

describe('yesterdayMsk', () => {
  it('чуть до полуночи МСК — вчера ещё не наступило', () => {
    expect(yesterdayMsk(new Date('2026-07-16T20:59:59Z'))).toBe('2026-07-15');
  });

  it('ровно в полночь МСК — сутки переключились', () => {
    expect(yesterdayMsk(new Date('2026-07-16T21:00:00Z'))).toBe('2026-07-16');
  });

  it('переход месяца', () => {
    expect(yesterdayMsk(new Date('2026-08-01T00:00:00Z'))).toBe('2026-07-31');
  });

  it('переход года', () => {
    expect(yesterdayMsk(new Date('2025-12-31T21:00:00Z'))).toBe('2025-12-31');
    expect(yesterdayMsk(new Date('2026-01-01T00:00:00Z'))).toBe('2025-12-31');
  });

  it('детерминизм: один и тот же момент — один и тот же результат', () => {
    const now = new Date('2026-03-15T12:00:00Z');
    expect(yesterdayMsk(now)).toBe(yesterdayMsk(new Date(now)));
  });

  it('не зависит от локального TZ хоста (использует только UTC-геттеры)', () => {
    const before = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
    const a = yesterdayMsk(new Date('2026-07-16T21:00:00Z'));
    process.env.TZ = 'Asia/Yekaterinburg';
    const b = yesterdayMsk(new Date('2026-07-16T21:00:00Z'));
    process.env.TZ = before;
    expect(a).toBe(b);
    expect(a).toBe('2026-07-16');
  });
});
