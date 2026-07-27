import { describe, it, expect } from 'vitest';
import type { JamPlaybackState } from '@vire/core';
import { effectivePaused, resolvePending, PENDING_TTL_MS } from './optimistic-playback';

const playback = (overrides?: Partial<JamPlaybackState>): JamPlaybackState => ({
  trackId: 't1',
  startedAtMs: 0,
  paused: false,
  pausedPositionMs: 0,
  version: 1,
  ...overrides,
});

describe('effectivePaused', () => {
  it('pending перекрывает серверное состояние', () => {
    expect(effectivePaused(playback({ paused: false }), { paused: true, at: 0 })).toBe(true);
    expect(effectivePaused(playback({ paused: true }), { paused: false, at: 0 })).toBe(false);
  });

  it('pending=null → серверное состояние как есть', () => {
    expect(effectivePaused(playback({ paused: true }), null)).toBe(true);
    expect(effectivePaused(playback({ paused: false }), null)).toBe(false);
  });

  it('playback=null и pending=null → не на паузе', () => {
    expect(effectivePaused(null, null)).toBe(false);
  });
});

describe('resolvePending', () => {
  it('сервер подтвердил желаемое состояние → pending снят', () => {
    const pending = { paused: true, at: 1000 };
    expect(resolvePending(pending, true, 1200, PENDING_TTL_MS)).toBeNull();
  });

  it('сервер прислал противоположное (чужая команда) → pending остаётся до TTL', () => {
    const pending = { paused: true, at: 1000 };
    expect(resolvePending(pending, false, 1200, PENDING_TTL_MS)).toEqual(pending);
  });

  it('протухший pending → снят даже без подтверждения', () => {
    const pending = { paused: true, at: 1000 };
    const now = 1000 + PENDING_TTL_MS + 1;
    expect(resolvePending(pending, false, now, PENDING_TTL_MS)).toBeNull();
  });

  it('pending=null → остаётся null', () => {
    expect(resolvePending(null, true, 1000, PENDING_TTL_MS)).toBeNull();
  });
});
