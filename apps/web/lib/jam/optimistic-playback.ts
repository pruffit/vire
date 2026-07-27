import type { JamPlaybackState } from '@vire/core';

export interface PendingToggle {
  paused: boolean;
  at: number;
  fromVersion: number;
}

export const PENDING_TTL_MS = 5_000;

// Каждая команда двигает серверный version ровно на 1, поэтому вторая команда подряд ждёт
// не текущую версию (её займёт первая), а следующую за ней — иначе ack первой снимет вторую.
export function nextPendingVersion(playback: JamPlaybackState | null, pending: PendingToggle | null): number {
  return pending ? pending.fromVersion + 1 : (playback?.version ?? 0);
}

export function effectivePaused(playback: JamPlaybackState | null, pending: PendingToggle | null): boolean {
  if (pending) return pending.paused;
  return Boolean(playback?.paused);
}

// Снимаем по version, а не по paused: любая долетевшая мутация (своя или чужая) двигает
// version, и с этого момента серверу можно верить. Сравнение по paused не различало
// чужую команду и не видело no-op (пауза поверх паузы: version растёт, paused нет).
export function resolvePending(
  pending: PendingToggle | null,
  serverVersion: number,
  now: number,
  ttlMs: number,
): PendingToggle | null {
  if (!pending) return null;
  if (serverVersion > pending.fromVersion) return null;
  if (now - pending.at > ttlMs) return null;
  return pending;
}
