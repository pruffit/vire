// Pure formatting helpers — no side effects or client-only APIs, safe on server and client.

/** Seconds → `m:ss` (e.g. 75 → "1:15"). Floors fractional seconds. */
export function formatDuration(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export interface ListenTimeUnit {
  seconds: string;
  minutes: string;
  hours: string;
}

/** Seconds → coarse human listen time (e.g. 45 → "45s", 600 → "10m", 3700 → "1h 1m");
 *  unit — локализованные суффиксы (common.listenTimeUnit из next-intl). */
export function formatListenTime(sec: number, unit: ListenTimeUnit): string {
  if (sec < 60) return `${sec}${unit.seconds}`;
  if (sec < 3600) return `${Math.floor(sec / 60)}${unit.minutes}`;
  return `${Math.floor(sec / 3600)}${unit.hours} ${Math.floor((sec % 3600) / 60)}${unit.minutes}`;
}

/** Compact count (e.g. 1500 → "1.5k", 999 → "999"). */
export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Release year from a Date or ISO string; null if absent or unparseable. */
export function releaseYear(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const year = new Date(date).getFullYear();
  return Number.isNaN(year) ? null : year;
}

/** Combined formatted duration of READY tracks (e.g. "12:34"); null if there is none. */
export function totalDuration(
  tracks: { status: string; durationSec: number | null }[],
): string | null {
  const total = tracks
    .filter((t) => t.status === 'READY' && t.durationSec != null)
    .reduce((s, t) => s + (t.durationSec ?? 0), 0);
  return total > 0 ? formatDuration(total) : null;
}
