const EPOCH_MS = Date.UTC(2026, 0, 11, 0, 0, 0);
const GROWTH_DAYS = 500;
const JITTER_PCT = 0.4;
const MIN_PROGRESS = 0.1;
const MAX_PROGRESS = 99.9;

function hashDateString(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  return (hash >>> 0) / 0xffffffff;
}

/** Детерминированное «загадочное» число процента для /fwqa688. */
export function blackSkyProgress(now: Date): number {
  const days = (now.getTime() - EPOCH_MS) / 86_400_000;
  const base = 100 * (1 - Math.exp(-days / GROWTH_DAYS));
  const dateKey = now.toISOString().slice(0, 10);
  const jitter = (hashDateString(dateKey) * 2 - 1) * JITTER_PCT;
  const clamped = Math.min(MAX_PROGRESS, Math.max(MIN_PROGRESS, base + jitter));
  return Math.round(clamped * 10000) / 10000;
}
