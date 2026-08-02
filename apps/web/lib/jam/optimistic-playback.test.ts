import { describe, it, expect } from 'vitest';
import type { JamPlaybackState } from '@vire/core';
import { effectivePaused, resolvePending, nextPendingVersion, PENDING_TTL_MS } from './optimistic-playback';

const playback = (overrides?: Partial<JamPlaybackState>): JamPlaybackState => ({
  itemId: 'item-1',
  startedAtMs: 0,
  paused: false,
  pausedPositionMs: 0,
  version: 1,
  ...overrides,
});

describe('effectivePaused', () => {
  it('pending перекрывает серверное состояние', () => {
    expect(effectivePaused(playback({ paused: false }), { paused: true, at: 0, fromVersion: 1 })).toBe(true);
    expect(effectivePaused(playback({ paused: true }), { paused: false, at: 0, fromVersion: 1 })).toBe(false);
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
  const pending = { paused: true, at: 1000, fromVersion: 3 };

  it('своя команда долетела (version вырос) → pending снят', () => {
    expect(resolvePending(pending, 4, 1200, PENDING_TTL_MS)).toBeNull();
  });

  it('чужая команда во время своего pending → pending снят, кнопка показывает правду', () => {
    // version двигает любая мутация, включая чужую: дальше врать нельзя
    expect(resolvePending(pending, 4, 1200, PENDING_TTL_MS)).toBeNull();
    expect(resolvePending(pending, 9, 1200, PENDING_TTL_MS)).toBeNull();
  });

  it('no-op команда (paused тот же, version вырос) → pending снят', () => {
    const noop = { paused: true, at: 1000, fromVersion: 3 };
    expect(resolvePending(noop, 4, 1200, PENDING_TTL_MS)).toBeNull();
  });

  it('команда ещё не долетела (version прежний) → pending держится', () => {
    expect(resolvePending(pending, 3, 1200, PENDING_TTL_MS)).toEqual(pending);
  });

  it('протухший pending → снят даже без подтверждения', () => {
    const now = 1000 + PENDING_TTL_MS + 1;
    expect(resolvePending(pending, 3, now, PENDING_TTL_MS)).toBeNull();
  });

  it('playback пропал (version 0) → pending держится до TTL', () => {
    expect(resolvePending(pending, 0, 1200, PENDING_TTL_MS)).toEqual(pending);
  });

  it('pending=null → остаётся null', () => {
    expect(resolvePending(null, 5, 1000, PENDING_TTL_MS)).toBeNull();
  });
});

describe('две свои команды подряд (клик до ack первой)', () => {
  it('ack первой не снимает pending второй, ack второй — снимает', () => {
    const first = { paused: true, at: 1000, fromVersion: nextPendingVersion(playback({ version: 10 }), null) };
    expect(first.fromVersion).toBe(10);

    // второй клик приходит, пока первый не подтверждён: серверный version локально всё ещё 10
    const second = {
      paused: false,
      at: 1050,
      fromVersion: nextPendingVersion(playback({ version: 10 }), first),
    };
    expect(second.fromVersion).toBe(11);

    // долетел ack первой команды — кнопка обязана остаться на желаемом от второго клика
    expect(resolvePending(second, 11, 1100, PENDING_TTL_MS)).toEqual(second);
    expect(effectivePaused(playback({ version: 11, paused: true }), second)).toBe(false);

    // долетел ack второй — pending снят, дальше правит сервер
    expect(resolvePending(second, 12, 1150, PENDING_TTL_MS)).toBeNull();
  });

  it('без pending версия берётся из серверного playback, при его отсутствии — 0', () => {
    expect(nextPendingVersion(playback({ version: 7 }), null)).toBe(7);
    expect(nextPendingVersion(null, null)).toBe(0);
  });
});
