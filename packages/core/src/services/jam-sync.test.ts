import { describe, it, expect } from 'vitest';
import {
  derivePositionMs,
  decideDriftCorrection,
  pickClockOffset,
  HARD_SEEK_MS,
  SEEK_COOLDOWN_MS,
  type JamPlaybackState,
  type DriftDamperState,
} from './jam-sync';

const state = (overrides: Partial<JamPlaybackState>): JamPlaybackState => ({
  itemId: 'item-1',
  startedAtMs: 0,
  paused: false,
  pausedPositionMs: 0,
  version: 1,
  ...overrides,
});

const NOT_DAMPED: DriftDamperState = { buffering: false, msSinceHardSeek: null };
const damper = (overrides: Partial<DriftDamperState>): DriftDamperState => ({ ...NOT_DAMPED, ...overrides });

describe('derivePositionMs', () => {
  it('paused returns pausedPositionMs regardless of serverNowMs', () => {
    expect(derivePositionMs(state({ paused: true, pausedPositionMs: 42000 }), 999999)).toBe(
      42000,
    );
  });

  it('playing returns serverNowMs - startedAtMs', () => {
    expect(derivePositionMs(state({ paused: false, startedAtMs: 1000 }), 6000)).toBe(5000);
  });

  it('clamps negative result to 0 (client clock skew)', () => {
    expect(derivePositionMs(state({ paused: false, startedAtMs: 5000 }), 1000)).toBe(0);
  });

  it('clamps negative pausedPositionMs to 0', () => {
    expect(derivePositionMs(state({ paused: true, pausedPositionMs: -10 }), 0)).toBe(0);
  });
});

describe('decideDriftCorrection', () => {
  it.each([
    ['far behind', 0, HARD_SEEK_MS + 1, { kind: 'seek', toMs: 0 }],
    ['far ahead', 10000, 10000 - HARD_SEEK_MS - 1, { kind: 'seek', toMs: 10000 }],
  ] as const)('%s: hard seek beyond HARD_SEEK_MS', (_label, expectedMs, actualMs, expected) => {
    expect(decideDriftCorrection(expectedMs, actualMs, NOT_DAMPED)).toEqual(expected);
  });

  it('exactly HARD_SEEK_MS is within tolerance — none', () => {
    expect(decideDriftCorrection(0, HARD_SEEK_MS, NOT_DAMPED)).toEqual({ kind: 'none' });
  });

  it('moderate drift well under HARD_SEEK_MS — none (никакой rate-коррекции)', () => {
    expect(decideDriftCorrection(1000, 1000 + HARD_SEEK_MS - 1, NOT_DAMPED)).toEqual({ kind: 'none' });
    expect(decideDriftCorrection(1000, 1000 - (HARD_SEEK_MS - 1), NOT_DAMPED)).toEqual({ kind: 'none' });
  });

  it('zero drift — none', () => {
    expect(decideDriftCorrection(5000, 5000, NOT_DAMPED)).toEqual({ kind: 'none' });
  });

  it('дрейф во время буферизации — none, даже если превышает HARD_SEEK_MS', () => {
    expect(decideDriftCorrection(0, HARD_SEEK_MS + 1, damper({ buffering: true }))).toEqual({
      kind: 'none',
    });
  });

  it('дрейф внутри cooldown после жёсткого seek — none', () => {
    expect(
      decideDriftCorrection(0, HARD_SEEK_MS + 1, damper({ msSinceHardSeek: SEEK_COOLDOWN_MS - 1 })),
    ).toEqual({ kind: 'none' });
  });

  it('после истечения cooldown — снова жёсткий seek', () => {
    expect(
      decideDriftCorrection(0, HARD_SEEK_MS + 1, damper({ msSinceHardSeek: SEEK_COOLDOWN_MS })),
    ).toEqual({ kind: 'seek', toMs: 0 });
  });
});

describe('pickClockOffset', () => {
  it('returns 0 for empty samples', () => {
    expect(pickClockOffset([])).toBe(0);
  });

  it('single sample: offset = tServer - (t0+t1)/2', () => {
    expect(pickClockOffset([{ t0: 100, tServer: 250, t1: 200 }])).toBe(100);
  });

  it('picks the sample with minimum RTT among several', () => {
    const samples = [
      { t0: 0, tServer: 1000, t1: 300 }, // rtt 300, offset 1000-150=850
      { t0: 0, tServer: 500, t1: 50 }, // rtt 50 (min), offset 500-25=475
      { t0: 0, tServer: 900, t1: 150 }, // rtt 150, offset 900-75=825
    ];
    expect(pickClockOffset(samples)).toBe(475);
  });

  it('tie-break: first minimal-RTT sample encountered wins', () => {
    const samples = [
      { t0: 0, tServer: 100, t1: 50 }, // rtt 50, offset 75
      { t0: 0, tServer: 200, t1: 50 }, // rtt 50 too, but not strictly less than first
    ];
    expect(pickClockOffset(samples)).toBe(75);
  });
});
