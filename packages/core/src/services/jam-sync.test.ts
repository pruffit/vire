import { describe, it, expect } from 'vitest';
import {
  derivePositionMs,
  decideDriftCorrection,
  pickClockOffset,
  HARD_SEEK_MS,
  RATE_CORRECT_MIN_MS,
  CONVERGED_MS,
  RATE_DELTA,
  type JamPlaybackState,
} from './jam-sync';

const state = (overrides: Partial<JamPlaybackState>): JamPlaybackState => ({
  trackId: 'track-1',
  startedAtMs: 0,
  paused: false,
  pausedPositionMs: 0,
  version: 1,
  ...overrides,
});

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
    expect(decideDriftCorrection(expectedMs, actualMs, 1)).toEqual(expected);
  });

  it('exactly HARD_SEEK_MS is rate correction, not seek (boundary inclusive to rate zone)', () => {
    expect(decideDriftCorrection(0, HARD_SEEK_MS, 1)).toEqual({
      kind: 'rate',
      rate: 1 - RATE_DELTA,
    });
  });

  it('client behind by >= RATE_CORRECT_MIN_MS speeds up (rate > 1)', () => {
    expect(decideDriftCorrection(1000, 1000 - RATE_CORRECT_MIN_MS, 1)).toEqual({
      kind: 'rate',
      rate: 1 + RATE_DELTA,
    });
  });

  it('client ahead by >= RATE_CORRECT_MIN_MS slows down (rate < 1)', () => {
    expect(decideDriftCorrection(1000, 1000 + RATE_CORRECT_MIN_MS, 1)).toEqual({
      kind: 'rate',
      rate: 1 - RATE_DELTA,
    });
  });

  it('exactly RATE_CORRECT_MIN_MS enters correction from rate 1 (hysteresis entry)', () => {
    expect(decideDriftCorrection(1000, 1000 + RATE_CORRECT_MIN_MS, 1)).toEqual({
      kind: 'rate',
      rate: 1 - RATE_DELTA,
    });
  });

  it('grey zone [CONVERGED_MS, RATE_CORRECT_MIN_MS): holds current correction when already correcting', () => {
    const drift = CONVERGED_MS + 10;
    expect(decideDriftCorrection(1000, 1000 + drift, 1 - RATE_DELTA)).toEqual({
      kind: 'rate',
      rate: 1 - RATE_DELTA,
    });
    expect(decideDriftCorrection(1000, 1000 - drift, 1 + RATE_DELTA)).toEqual({
      kind: 'rate',
      rate: 1 + RATE_DELTA,
    });
  });

  it('grey zone [CONVERGED_MS, RATE_CORRECT_MIN_MS): does nothing when rate already 1', () => {
    expect(decideDriftCorrection(1000, 1000 + CONVERGED_MS + 10, 1)).toEqual({ kind: 'none' });
  });

  it('exactly CONVERGED_MS is grey zone (not converged), holds correction', () => {
    expect(decideDriftCorrection(1000, 1000 + CONVERGED_MS, 1 - RATE_DELTA)).toEqual({
      kind: 'rate',
      rate: 1 - RATE_DELTA,
    });
  });

  it('below CONVERGED_MS with active correction resets rate to 1 (hysteresis exit)', () => {
    expect(decideDriftCorrection(1000, 1000 + CONVERGED_MS - 1, 1 - RATE_DELTA)).toEqual({
      kind: 'rate',
      rate: 1,
    });
    expect(decideDriftCorrection(1000, 1000 - (CONVERGED_MS - 1), 1 + RATE_DELTA)).toEqual({
      kind: 'rate',
      rate: 1,
    });
  });

  it('below CONVERGED_MS with rate already 1 does nothing', () => {
    expect(decideDriftCorrection(1000, 1000 + CONVERGED_MS - 1, 1)).toEqual({ kind: 'none' });
    expect(decideDriftCorrection(1000, 1000, 1)).toEqual({ kind: 'none' });
  });

  it('zero drift with rate already 1 does nothing', () => {
    expect(decideDriftCorrection(5000, 5000, 1)).toEqual({ kind: 'none' });
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
