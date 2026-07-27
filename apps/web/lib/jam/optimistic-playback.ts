import type { JamPlaybackState } from '@vire/core';

export interface PendingToggle {
  paused: boolean;
  at: number;
}

export const PENDING_TTL_MS = 5_000;

export function effectivePaused(playback: JamPlaybackState | null, pending: PendingToggle | null): boolean {
  if (pending) return pending.paused;
  return Boolean(playback?.paused);
}

export function resolvePending(
  pending: PendingToggle | null,
  serverPaused: boolean,
  now: number,
  ttlMs: number,
): PendingToggle | null {
  if (!pending) return null;
  if (pending.paused === serverPaused) return null;
  if (now - pending.at > ttlMs) return null;
  return pending;
}
