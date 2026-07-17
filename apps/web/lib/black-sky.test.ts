import { describe, it, expect } from 'vitest';
import { blackSkyProgress } from './black-sky';

describe('blackSkyProgress', () => {
  it('детерминирована — один и тот же момент даёт одно и то же число', () => {
    const now = new Date('2026-07-17T12:00:00Z');
    expect(blackSkyProgress(now)).toBe(blackSkyProgress(new Date(now)));
  });

  it('растёт от месяца к месяцу (джиттер меньше месячного прироста)', () => {
    const early = blackSkyProgress(new Date('2026-06-01T00:00:00Z'));
    const late = blackSkyProgress(new Date('2027-06-01T00:00:00Z'));
    expect(late).toBeGreaterThan(early);
  });

  it('не выходит за границы [0.1, 99.9]', () => {
    const dates = [
      '2026-01-11T00:00:00Z',
      '2026-02-11T00:00:00Z',
      '2030-01-11T00:00:00Z',
      '2100-01-11T00:00:00Z',
    ];
    for (const d of dates) {
      const value = blackSkyProgress(new Date(d));
      expect(value).toBeGreaterThanOrEqual(0.1);
      expect(value).toBeLessThanOrEqual(99.9);
    }
  });

  it('дата до эпохи → минимум 0.1', () => {
    expect(blackSkyProgress(new Date('2020-01-01T00:00:00Z'))).toBe(0.1);
    expect(blackSkyProgress(new Date('2025-01-01T00:00:00Z'))).toBe(0.1);
  });

  it('округляет до 4 знаков после запятой', () => {
    const value = blackSkyProgress(new Date('2026-09-03T15:22:00Z'));
    expect(value).toBe(Math.round(value * 10000) / 10000);
  });
});
