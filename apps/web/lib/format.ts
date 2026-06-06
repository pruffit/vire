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

/** Russian plural for "трек" (1 → "трек", 2 → "трека", 5 → "треков"). */
export function pluralTracks(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'трек';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'трека';
  return 'треков';
}
