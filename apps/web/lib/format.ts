/**
 * Pure formatting helpers shared across server and client components.
 * No side effects, no client-only APIs — safe to import from either side.
 */

/** Seconds → `m:ss` (e.g. 75 → "1:15"). Floors fractional seconds. */
export function formatDuration(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Seconds → coarse human listen time in Russian (e.g. 45 → "45с", 600 → "10м", 3700 → "1ч 1м"). */
export function formatListenTime(sec: number): string {
  if (sec < 60) return `${sec}с`;
  if (sec < 3600) return `${Math.floor(sec / 60)}м`;
  return `${Math.floor(sec / 3600)}ч ${Math.floor((sec % 3600) / 60)}м`;
}

/** Compact count (e.g. 1500 → "1.5k", 999 → "999"). */
export function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/**
 * Russian pluralization: picks one/few/many by the count.
 * `plural(n, ['ссылка', 'ссылки', 'ссылок'])`.
 */
export function plural(n: number, forms: readonly [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

/** Russian plural for "трек" (1 → "трек", 2 → "трека", 5 → "треков"). */
export function pluralTracks(n: number): string {
  return plural(n, ['трек', 'трека', 'треков']);
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
