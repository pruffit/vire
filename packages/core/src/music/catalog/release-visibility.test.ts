import { describe, it, expect } from 'vitest';
import { isReleasePubliclyVisible, isCountdownVisible } from './release-visibility';

const NOW = new Date('2026-07-10T12:00:00Z');
const PAST = new Date('2026-07-01T00:00:00Z');
const FUTURE = new Date('2026-08-01T00:00:00Z');

describe('isReleasePubliclyVisible', () => {
  it('PUBLISHED виден всегда, даже без даты', () => {
    expect(isReleasePubliclyVisible({ status: 'PUBLISHED', releaseDate: null }, NOW)).toBe(true);
    expect(isReleasePubliclyVisible({ status: 'PUBLISHED', releaseDate: FUTURE }, NOW)).toBe(true);
  });

  it('SCHEDULED виден только после наступления даты', () => {
    expect(isReleasePubliclyVisible({ status: 'SCHEDULED', releaseDate: PAST }, NOW)).toBe(true);
    expect(isReleasePubliclyVisible({ status: 'SCHEDULED', releaseDate: FUTURE }, NOW)).toBe(false);
    expect(isReleasePubliclyVisible({ status: 'SCHEDULED', releaseDate: null }, NOW)).toBe(false);
  });

  it('момент даты выхода включительно', () => {
    expect(isReleasePubliclyVisible({ status: 'SCHEDULED', releaseDate: NOW }, NOW)).toBe(true);
  });

  it('DRAFT и ARCHIVED не видны никогда', () => {
    for (const releaseDate of [null, PAST, FUTURE]) {
      expect(isReleasePubliclyVisible({ status: 'DRAFT', releaseDate }, NOW)).toBe(false);
      expect(isReleasePubliclyVisible({ status: 'ARCHIVED', releaseDate }, NOW)).toBe(false);
    }
  });
});

describe('isCountdownVisible', () => {
  it('только SCHEDULED с будущей датой', () => {
    expect(isCountdownVisible({ status: 'SCHEDULED', releaseDate: FUTURE }, NOW)).toBe(true);
    expect(isCountdownVisible({ status: 'SCHEDULED', releaseDate: PAST }, NOW)).toBe(false);
    expect(isCountdownVisible({ status: 'SCHEDULED', releaseDate: null }, NOW)).toBe(false);
    expect(isCountdownVisible({ status: 'DRAFT', releaseDate: FUTURE }, NOW)).toBe(false);
    expect(isCountdownVisible({ status: 'PUBLISHED', releaseDate: FUTURE }, NOW)).toBe(false);
  });

  it('релиз либо виден, либо на отсчёте, но не одновременно', () => {
    const cases = [
      { status: 'SCHEDULED' as const, releaseDate: FUTURE },
      { status: 'SCHEDULED' as const, releaseDate: PAST },
      { status: 'PUBLISHED' as const, releaseDate: PAST },
      { status: 'DRAFT' as const, releaseDate: FUTURE },
    ];
    for (const release of cases) {
      expect(isReleasePubliclyVisible(release, NOW) && isCountdownVisible(release, NOW)).toBe(false);
    }
  });
});
