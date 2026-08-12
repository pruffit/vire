export const WAVE_ERROR_LIMIT = 3;
export const LOCAL_MISS_LIMIT = 3;
export const PREFETCH_LEAD_SEC = 15;
export const TICK_INTERVAL_MS = 5_000;
export const PLAYED_IDS_WINDOW = 100;

/** После N подряд неудачных загрузок манифеста волна сдаётся вместо очередного skip. */
export function shouldGiveUpOnWave(consecutiveErrors: number): boolean {
  return consecutiveErrors >= WAVE_ERROR_LIMIT;
}

/** После N подряд пропавших локальных файлов движок перестаёт долбить next() вхолостую. */
export function shouldStopLocalRetries(misses: number): boolean {
  return misses >= LOCAL_MISS_LIMIT;
}

/** true, когда до конца трека осталось меньше PREFETCH_LEAD_SEC — пора тянуть следующий манифест. */
export function shouldPrefetchNext(currentTime: number, duration: number): boolean {
  return duration - currentTime < PREFETCH_LEAD_SEC;
}

/** Троттл живого тика (буфер волны/префетч/персист currentTime). */
export function shouldRunTick(now: number, lastTickAt: number): boolean {
  return now - lastTickAt >= TICK_INTERVAL_MS;
}

/** Индекс после регидрации persist: -1 (не найден) и выход за границы → 0. */
export function clampRestoredQueueIndex(index: number, queueLength: number): number {
  if (index < 0 || index >= queueLength) return 0;
  return index;
}

/** Хвост «проигранного» для анти-повтора волны — последние PLAYED_IDS_WINDOW id. */
export function playedIdsWindow(ids: string[]): string[] {
  return ids.slice(-PLAYED_IDS_WINDOW);
}
